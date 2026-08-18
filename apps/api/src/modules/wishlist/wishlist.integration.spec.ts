import 'dotenv/config';
import { BadRequestException } from '@nestjs/common';
import { ProductStatus, ShopStatus, UserRole } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { PrismaService } from '../../prisma/prisma.service';
import { WishlistService } from './wishlist.service';

describe('WishlistService integration', () => {
  const prisma = new PrismaService();
  const service = new WishlistService(prisma);
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const emails = [
    `wishlist-owner-${nonce}@example.com`,
    `wishlist-customer-a-${nonce}@example.com`,
    `wishlist-customer-b-${nonce}@example.com`,
  ];
  let ownerId: string;
  let customerAId: string;
  let customerBId: string;
  let shopId: string;
  let productId: string;
  let categoryId: number;

  beforeAll(async () => {
    await prisma.$connect();
    const [owner, customerA, customerB] = await Promise.all([
      prisma.user.create({ data: { email: emails[0], passwordHash: 'test-only', fullName: 'Wishlist Owner', role: UserRole.VENDOR } }),
      prisma.user.create({ data: { email: emails[1], passwordHash: 'test-only', fullName: 'Wishlist Customer A' } }),
      prisma.user.create({ data: { email: emails[2], passwordHash: 'test-only', fullName: 'Wishlist Customer B' } }),
    ]);
    ownerId = owner.id;
    customerAId = customerA.id;
    customerBId = customerB.id;
    const category = await prisma.category.create({ data: { name: `Wishlist ${nonce}`, slug: `wishlist-${nonce}` } });
    categoryId = category.id;
    const shop = await prisma.shop.create({
      data: { ownerId, name: `Wishlist Shop ${nonce}`, slug: `wishlist-shop-${nonce}`, status: ShopStatus.APPROVED },
    });
    shopId = shop.id;
    const product = await prisma.product.create({
      data: {
        shopId,
        categoryId,
        name: `Wishlist Product ${nonce}`,
        slug: `wishlist-product-${nonce}`,
        price: 125000,
        status: ProductStatus.ACTIVE,
        inventory: { create: { onHand: 5, reserved: 1 } },
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.shop.deleteMany({ where: { id: shopId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
  });

  it('adds idempotently and isolates each account wishlist', async () => {
    await service.add(customerAId, productId);
    await service.add(customerAId, productId);

    await expect(prisma.wishlistItem.count({ where: { userId: customerAId, productId } })).resolves.toBe(1);
    await expect(service.productIds(customerAId)).resolves.toEqual({ productIds: [productId] });
    const page = await service.list(customerAId, { page: 1, limit: 20 });
    expect(page.total).toBe(1);
    expect(page.items[0].product).toEqual(expect.objectContaining({ id: productId, available: 4, isPurchasable: true }));

    await service.remove(customerBId, productId);
    await expect(service.productIds(customerBId)).resolves.toEqual({ productIds: [] });
    await expect(prisma.wishlistItem.count({ where: { userId: customerAId, productId } })).resolves.toBe(1);
  });

  it('preserves unavailable saved items but rejects new unavailable products', async () => {
    await prisma.product.update({ where: { id: productId }, data: { status: ProductStatus.DRAFT } });
    const page = await service.list(customerAId, { page: 1, limit: 20 });
    expect(page.items[0].product).toEqual(expect.objectContaining({ id: productId, isPurchasable: false }));
    await expect(service.add(customerBId, productId)).rejects.toBeInstanceOf(BadRequestException);

    await service.remove(customerAId, productId);
    await expect(service.list(customerAId, { page: 1, limit: 20 })).resolves.toEqual(expect.objectContaining({ total: 0 }));
  });
});
