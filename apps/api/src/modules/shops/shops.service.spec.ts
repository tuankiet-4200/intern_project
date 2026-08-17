import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AccountStatus, ShopStatus } from '@prisma/client';
import { describe, expect, it, jest } from '@jest/globals';
import { ShopsService } from './shops.service';

describe('ShopsService', () => {
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
