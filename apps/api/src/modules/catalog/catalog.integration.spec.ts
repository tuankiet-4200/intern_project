import 'dotenv/config';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ProductStatus, ShopStatus, UserRole } from '@prisma/client';
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
        initialStock: 5,
      });
      productId = product.id;

      await expect(
        catalog.updateProduct(otherVendor.id, product.id, { name: 'Unauthorized Update' }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      const updated = await catalog.updateProduct(owner.id, product.id, { name: 'Updated Product' });
      expect(updated.name).toBe('Updated Product');

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
