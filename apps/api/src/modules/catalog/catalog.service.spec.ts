import { ProductStatus, ShopStatus } from '@prisma/client';
import { describe, expect, it, jest } from '@jest/globals';
import { CatalogService } from './catalog.service';

describe('CatalogService public visibility', () => {
  it('requires active product, approved shop and positive available stock', async () => {
    const reservedField = { _ref: 'reserved' };
    const prisma = {
      inventory: { fields: { reserved: reservedField } },
      product: {
        findMany: jest.fn<(args: unknown) => Promise<never[]>>().mockResolvedValue([]),
        count: jest.fn<(args: unknown) => Promise<number>>().mockResolvedValue(0),
      },
    };
    const service = new CatalogService(prisma as never, {} as never);

    await service.findPublicProducts({ page: 1, limit: 20 });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: ProductStatus.ACTIVE,
          shop: { status: ShopStatus.APPROVED },
          inventory: { is: { onHand: { gt: reservedField } } },
        },
      }),
    );
    expect(prisma.product.count).toHaveBeenCalledWith({
      where: {
        status: ProductStatus.ACTIVE,
        shop: { status: ShopStatus.APPROVED },
        inventory: { is: { onHand: { gt: reservedField } } },
      },
    });
  });

  it('applies the same visibility rules to product detail', async () => {
    const reservedField = { _ref: 'reserved' };
    const prisma = {
      inventory: { fields: { reserved: reservedField } },
      product: { findFirst: jest.fn<(args: unknown) => Promise<null>>().mockResolvedValue(null) },
    };
    const service = new CatalogService(prisma as never, {} as never);

    await service.findProductBySlug('draft-product');

    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          slug: 'draft-product',
          status: ProductStatus.ACTIVE,
          shop: { status: ShopStatus.APPROVED },
          inventory: { is: { onHand: { gt: reservedField } } },
        },
      }),
    );
  });
});
