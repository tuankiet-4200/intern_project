import { ForbiddenException } from '@nestjs/common';
import { InventoryReason, UserRole } from '@prisma/client';
import { describe, expect, it, jest } from '@jest/globals';
import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  it('does not expose inventory ledger to another vendor', async () => {
    const prisma = {
      inventory: {
        findUnique: jest.fn<() => Promise<object>>().mockResolvedValue({
          id: 'inventory-1',
          productId: 'product-1',
          onHand: 10,
          reserved: 0,
          product: { shop: { ownerId: 'vendor-1' } },
          ledger: [],
        }),
      },
    };
    const service = new InventoryService(prisma as never);

    await expect(service.getByProduct('vendor-2', UserRole.VENDOR, 'product-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('adjusts stock with compare-and-swap and writes a ledger row', async () => {
    const inventory = { id: 'inventory-1', productId: 'product-1', onHand: 10, reserved: 2, sold: 0 };
    const updated = { ...inventory, onHand: 13 };
    const tx = {
      inventory: {
        findUnique: jest.fn<() => Promise<typeof inventory>>().mockResolvedValue(inventory),
        updateMany: jest.fn<(args: unknown) => Promise<{ count: number }>>().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn<() => Promise<typeof updated>>().mockResolvedValue(updated),
      },
      inventoryLedger: {
        create: jest.fn<(args: unknown) => Promise<object>>().mockResolvedValue({}),
      },
    };
    const prisma = {
      product: {
        findUnique: jest.fn<() => Promise<object>>().mockResolvedValue({
          id: 'product-1',
          shop: { ownerId: 'vendor-1' },
          inventory,
        }),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new InventoryService(prisma as never);

    const result = await service.adjust('vendor-1', 'product-1', {
      quantity: 3,
      reason: InventoryReason.MANUAL_ADJUSTMENT,
    });

    expect(tx.inventory.updateMany).toHaveBeenCalledWith({
      where: { id: 'inventory-1', onHand: 10, reserved: 2 },
      data: { onHand: 13 },
    });
    expect(tx.inventoryLedger.create).toHaveBeenCalledWith({
      data: {
        inventoryId: 'inventory-1',
        deltaOnHand: 3,
        reason: InventoryReason.MANUAL_ADJUSTMENT,
      },
    });
    expect(result.available).toBe(11);
  });

  it('reserves stock atomically and writes a reservation ledger row', async () => {
    const inventory = { id: 'inventory-1', productId: 'product-1', onHand: 10, reserved: 2, sold: 0 };
    const updated = { ...inventory, reserved: 5 };
    const tx = {
      inventory: {
        findUnique: jest.fn<() => Promise<typeof inventory>>().mockResolvedValue(inventory),
        updateMany: jest.fn<(args: unknown) => Promise<{ count: number }>>().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn<() => Promise<typeof updated>>().mockResolvedValue(updated),
      },
      inventoryLedger: {
        create: jest.fn<(args: unknown) => Promise<object>>().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new InventoryService(prisma as never);

    const result = await service.reserve('product-1', { quantity: 3, referenceId: 'order-1' });

    expect(tx.inventory.updateMany).toHaveBeenCalledWith({
      where: { id: 'inventory-1', onHand: 10, reserved: 2 },
      data: { reserved: { increment: 3 } },
    });
    expect(tx.inventoryLedger.create).toHaveBeenCalledWith({
      data: {
        inventoryId: 'inventory-1',
        deltaReserve: 3,
        reason: InventoryReason.ORDER_RESERVED,
        referenceId: 'order-1',
      },
    });
    expect(result.available).toBe(5);
  });
});
