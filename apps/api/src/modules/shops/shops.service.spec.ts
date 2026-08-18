import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AccountStatus, ProductStatus, ShopStatus } from '@prisma/client';
import { describe, expect, it, jest } from '@jest/globals';
import { ShopsService } from './shops.service';

describe('ShopsService', () => {
  it('returns only public in-stock products and categories for an approved storefront', async () => {
    const reservedField = { _ref: 'reserved' };
    const prisma = {
      inventory: { fields: { reserved: reservedField } },
      shop: { findFirst: jest.fn<() => Promise<object>>().mockResolvedValue({ id: 'shop-1', slug: 'north-studio' }) },
      product: {
        findMany: jest.fn<(args: unknown) => Promise<never[]>>().mockResolvedValue([]),
        count: jest.fn<(args: unknown) => Promise<number>>().mockResolvedValue(0),
      },
      category: { findMany: jest.fn<(args: unknown) => Promise<never[]>>().mockResolvedValue([]) },
      $transaction: jest.fn(async (promises: Promise<unknown>[]) => Promise.all(promises)),
    };
    const service = new ShopsService(prisma as never);

    await service.findPublicStorefront('north-studio', { page: 1, limit: 20 });

    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        shopId: 'shop-1',
        status: ProductStatus.ACTIVE,
        inventory: { is: { onHand: { gt: reservedField } } },
      },
    }));
    expect(prisma.category.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ products: { some: expect.objectContaining({ shopId: 'shop-1' }) } }),
    }));
  });

  it('rejects access to another vendor shop', async () => {
    const prisma = {
      shop: {
        findUnique: jest.fn<() => Promise<{ id: string; ownerId: string }>>().mockResolvedValue({
          id: 'shop-1',
          ownerId: 'owner-1',
        }),
      },
    };
    const service = new ShopsService(prisma as never);

    await expect(service.assertOwner('shop-1', 'owner-2')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('promotes a customer to vendor when their shop is approved', async () => {
    const tx = {
      shop: {
        update: jest.fn<() => Promise<{ id: string; status: ShopStatus }>>().mockResolvedValue({
          id: 'shop-1',
          status: ShopStatus.APPROVED,
        }),
      },
      user: {
        updateMany: jest.fn<(args: unknown) => Promise<{ count: number }>>().mockResolvedValue({ count: 1 }),
      },
      adminAuditLog: {
        create: jest.fn<(args: unknown) => Promise<object>>().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const prisma = {
      shop: {
        findUnique: jest.fn<() => Promise<{ id: string; ownerId: string; status: ShopStatus; owner: { status: AccountStatus } }>>().mockResolvedValue({
          id: 'shop-1',
          ownerId: 'customer-1',
          status: ShopStatus.PENDING_REVIEW,
          owner: { status: AccountStatus.ACTIVE },
        }),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new ShopsService(prisma as never);

    await service.adminUpdateStatus('admin-1', 'shop-1', { status: ShopStatus.APPROVED });

    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'customer-1', role: 'CUSTOMER' },
      data: { role: 'VENDOR' },
    });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ actorId: 'admin-1', targetId: 'shop-1' }),
    }));
  });

  it('requires a reason for shop suspension', async () => {
    const prisma = {
      shop: {
        findUnique: jest.fn<() => Promise<object>>().mockResolvedValue({
          id: 'shop-1', ownerId: 'vendor-1', status: ShopStatus.APPROVED, owner: { status: AccountStatus.ACTIVE },
        }),
      },
    };
    const service = new ShopsService(prisma as never);

    await expect(service.adminUpdateStatus('admin-1', 'shop-1', { status: ShopStatus.SUSPENDED }))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
