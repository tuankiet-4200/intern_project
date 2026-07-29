import 'dotenv/config';
import { InventoryReason, ProductStatus, ShopStatus, UserRole } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from './inventory.service';

describe('InventoryService integration', () => {
  it('does not oversell when reservations race', async () => {
    const prisma = new PrismaService();
    const inventoryService = new InventoryService(prisma);
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let userId: string | undefined;
    let shopId: string | undefined;
    let categoryId: number | undefined;
    let productId: string | undefined;

    await prisma.$connect();

    try {
      const user = await prisma.user.create({
        data: {
          email: `inventory-test-${suffix}@example.com`,
          passwordHash: 'not-used',
          fullName: 'Inventory Test Vendor',
          role: UserRole.VENDOR,
        },
      });
      userId = user.id;

      const shop = await prisma.shop.create({
        data: {
          ownerId: user.id,
          name: 'Inventory Test Shop',
          slug: `inventory-test-shop-${suffix}`,
          status: ShopStatus.APPROVED,
        },
      });
      shopId = shop.id;

      const category = await prisma.category.create({
        data: { name: 'Inventory Test', slug: `inventory-test-category-${suffix}` },
      });
      categoryId = category.id;

      const product = await prisma.product.create({
        data: {
          shopId: shop.id,
          categoryId: category.id,
          name: 'Inventory Test Product',
          slug: `inventory-test-product-${suffix}`,
          price: 100,
          status: ProductStatus.ACTIVE,
          inventory: {
            create: {
              onHand: 10,
              ledger: {
                create: {
                  deltaOnHand: 10,
                  reason: InventoryReason.INITIAL_STOCK,
                },
              },
            },
          },
        },
      });
      productId = product.id;

      const reservations = await Promise.allSettled([
        inventoryService.reserve(product.id, { quantity: 7, referenceId: `order-a-${suffix}` }),
        inventoryService.reserve(product.id, { quantity: 7, referenceId: `order-b-${suffix}` }),
      ]);

      expect(reservations.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(reservations.filter((result) => result.status === 'rejected')).toHaveLength(1);

      const inventory = await prisma.inventory.findUniqueOrThrow({
        where: { productId: product.id },
        include: {
          ledger: {
            where: { reason: InventoryReason.ORDER_RESERVED },
          },
        },
      });
      expect(inventory.reserved).toBe(7);
      expect(inventory.onHand - inventory.reserved).toBe(3);
      expect(inventory.ledger).toHaveLength(1);
    } finally {
      if (productId) await prisma.product.delete({ where: { id: productId } });
      if (shopId) await prisma.shop.delete({ where: { id: shopId } });
      if (categoryId) await prisma.category.delete({ where: { id: categoryId } });
      if (userId) await prisma.user.delete({ where: { id: userId } });
      await prisma.$disconnect();
    }
  });
});
