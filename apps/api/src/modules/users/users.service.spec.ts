import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { UsersService } from './users.service';

describe('UsersService', () => {
  it('keeps the first address as default', async () => {
    const tx = {
      userAddress: {
        count: jest.fn<(args: unknown) => Promise<number>>().mockResolvedValue(0),
        updateMany: jest.fn<(args: unknown) => Promise<{ count: number }>>().mockResolvedValue({ count: 0 }),
        create: jest.fn<(args: { data: { isDefault: boolean } }) => Promise<object>>().mockImplementation(
          async ({ data }) => ({ id: 'address-1', ...data }),
        ),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new UsersService(prisma as never);

    const result = await service.createAddress('user-1', {
      recipient: 'Customer',
      phone: '0900000000',
      line1: '1 Main Street',
      ward: 'Ward 1',
      district: 'District 1',
      city: 'HCM',
    });

    expect(result).toEqual(expect.objectContaining({ isDefault: true }));
  });

  it('does not allow directly unsetting the default address', async () => {
    const tx = {
      userAddress: {
        findFirst: jest.fn<() => Promise<object>>().mockResolvedValue({
          id: 'address-1',
          userId: 'user-1',
          isDefault: true,
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new UsersService(prisma as never);

    await expect(service.updateAddress('user-1', 'address-1', { isDefault: false })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('does not update an address owned by another user', async () => {
    const tx = {
      userAddress: {
        findFirst: jest.fn<() => Promise<null>>().mockResolvedValue(null),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new UsersService(prisma as never);

    await expect(service.updateAddress('user-2', 'address-1', { city: 'Hanoi' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
