import { ForbiddenException } from '@nestjs/common';
import { ShopStatus } from '@prisma/client';
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
    };
    const prisma = {
      shop: {
        findUnique: jest.fn<() => Promise<{ id: string; ownerId: string }>>().mockResolvedValue({
          id: 'shop-1',
          ownerId: 'customer-1',
        }),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new ShopsService(prisma as never);

    await service.review('shop-1', { status: ShopStatus.APPROVED });

    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'customer-1', role: 'CUSTOMER' },
      data: { role: 'VENDOR' },
    });
  });
});
