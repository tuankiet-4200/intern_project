import 'dotenv/config';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { InventoryReason, ProductStatus, ShopStatus, UserRole } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';
import { PrismaService } from '../../prisma/prisma.service';
import { ShopsService } from '../shops/shops.service';
import { CatalogService } from './catalog.service';

describe('CatalogService integration', () => {
  it('enforces product ownership, terminal archive, and category hierarchy rules', async () => {
    const prisma = new PrismaService();
    const catalog = new CatalogService(prisma, new ShopsService(prisma));
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const userIds: string[] = [];
    const shopIds: string[] = [];
    const categoryIds: number[] = [];
    let productId: string | undefined;

    await prisma.$connect();
    try {
      const [owner, otherVendor] = await Promise.all([
        prisma.user.create({
          data: {
            email: `catalog-owner-${suffix}@example.com`,
            passwordHash: 'not-used',
            fullName: 'Catalog Owner',
            role: UserRole.VENDOR,
          },
        }),
        prisma.user.create({
          data: {
            email: `catalog-other-${suffix}@example.com`,
            passwordHash: 'not-used',
            fullName: 'Other Vendor',
            role: UserRole.VENDOR,
          },
        }),
      ]);
      userIds.push(owner.id, otherVendor.id);

      const [shop, otherShop] = await Promise.all([
        prisma.shop.create({
          data: {
            ownerId: owner.id,
            name: 'Catalog Test Shop',
            slug: `catalog-test-shop-${suffix}`,
            status: ShopStatus.APPROVED,
          },
        }),
        prisma.shop.create({
          data: {
            ownerId: otherVendor.id,
            name: 'Other Catalog Shop',
            slug: `other-catalog-shop-${suffix}`,
            status: ShopStatus.APPROVED,
          },
        }),
      ]);
      shopIds.push(shop.id, otherShop.id);

      const root = await catalog.createCategory({
        name: 'Catalog Root',
        slug: `catalog-root-${suffix}`,
      });
      categoryIds.push(root.id);
      const child = await catalog.createCategory({
        name: 'Catalog Child',
        slug: `catalog-child-${suffix}`,
        parentId: root.id,
      });
      categoryIds.push(child.id);

      const product = await catalog.createProduct(owner.id, shop.id, {
        name: 'Catalog Test Product',
        slug: `catalog-test-product-${suffix}`,
        categoryId: root.id,
        price: 100,
        compareAtPrice: 125,
        description: 'Original catalog description',
        images: ['https://images.example.com/catalog-original.jpg'],
        attributes: { color: 'green', warrantyMonths: 12 },
        initialStock: 5,
      });
      productId = product.id;
      expect(product.compareAtPrice?.toString()).toBe('125');
      expect(product.images).toEqual(['https://images.example.com/catalog-original.jpg']);
      expect(product.attributes).toEqual({ color: 'green', warrantyMonths: 12 });

      await expect(catalog.updateProduct(owner.id, product.id, { compareAtPrice: 90 })).rejects.toThrow(
        'Compare-at price must be greater than price',
      );

      await expect(
        catalog.updateProduct(otherVendor.id, product.id, { name: 'Unauthorized Update' }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      const updated = await catalog.updateProduct(owner.id, product.id, {
        name: 'Updated Product',
        slug: `updated-catalog-product-${suffix}`,
        categoryId: child.id,
        price: 110,
        compareAtPrice: 150,
        description: 'Updated catalog description',
        images: ['https://images.example.com/catalog-updated.jpg'],
        attributes: { material: 'steel', featured: true },
        stockOnHand: 12,
      });
      expect(updated.name).toBe('Updated Product');
      expect(updated.slug).toBe(`updated-catalog-product-${suffix}`);
      expect(updated.categoryId).toBe(child.id);
      expect(updated.description).toBe('Updated catalog description');
      expect(updated.compareAtPrice?.toString()).toBe('150');
      expect(updated.images).toEqual(['https://images.example.com/catalog-updated.jpg']);
      expect(updated.attributes).toEqual({ material: 'steel', featured: true });
      expect(updated.inventory?.onHand).toBe(12);
      await expect(prisma.inventoryLedger.findFirstOrThrow({
        where: { inventoryId: updated.inventory!.id, reason: InventoryReason.MANUAL_ADJUSTMENT },
        orderBy: { createdAt: 'desc' },
      })).resolves.toEqual(expect.objectContaining({ deltaOnHand: 7 }));

      await prisma.inventory.update({ where: { productId: product.id }, data: { reserved: 2 } });
      await expect(catalog.updateProduct(owner.id, product.id, {
        name: 'Must Roll Back',
        stockOnHand: 1,
      })).rejects.toThrow('lower than reserved stock');
      await expect(prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
        .resolves.toEqual(expect.objectContaining({ name: 'Updated Product' }));
      await expect(prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } }))
        .resolves.toEqual(expect.objectContaining({ onHand: 12, reserved: 2 }));
      await prisma.inventory.update({ where: { productId: product.id }, data: { reserved: 0 } });

      const active = await catalog.updateProductStatus(owner.id, product.id, {
        status: ProductStatus.ACTIVE,
      });
      expect(active.status).toBe(ProductStatus.ACTIVE);

      const archived = await catalog.archiveProduct(owner.id, product.id);
      expect(archived.status).toBe(ProductStatus.ARCHIVED);
      await expect(
        catalog.updateProductStatus(owner.id, product.id, { status: ProductStatus.ACTIVE }),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(catalog.updateCategory(root.id, { parentId: child.id })).rejects.toThrow(
        'Category parent would create a cycle',
      );
      await expect(catalog.updateCategoryStatus(root.id, { isActive: false })).rejects.toThrow(
        'Deactivate child categories first',
      );
    } finally {
      if (productId) await prisma.product.delete({ where: { id: productId } });
      for (const categoryId of categoryIds.reverse()) {
        await prisma.category.delete({ where: { id: categoryId } });
      }
      for (const shopId of shopIds) await prisma.shop.delete({ where: { id: shopId } });
      for (const userId of userIds) await prisma.user.delete({ where: { id: userId } });
      await prisma.$disconnect();
    }
  });
});
