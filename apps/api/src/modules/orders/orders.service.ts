import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryReason, ParentOrderStatus, PaymentStatus, Prisma, ShopOrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ShopsService } from '../shops/shops.service';

const ORDER_INCLUDE = {
  shopOrders: {
    orderBy: { createdAt: 'asc' as const },
    include: { shop: { select: { id: true, name: true, slug: true } }, items: true },
  },
  payments: { orderBy: { createdAt: 'asc' as const }, include: { statusHistory: true } },
  couponUsages: { include: { coupon: { select: { code: true, scope: true, type: true } } } },
} as const;

const SHOP_ORDER_TRANSITIONS: Record<ShopOrderStatus, ShopOrderStatus[]> = {
  PENDING_CONFIRMATION: [ShopOrderStatus.CONFIRMED, ShopOrderStatus.CANCELLED],
  CONFIRMED: [ShopOrderStatus.PACKING, ShopOrderStatus.CANCELLED],
  PACKING: [ShopOrderStatus.READY_TO_HANDOFF],
  READY_TO_HANDOFF: [ShopOrderStatus.DELIVERED],
  DELIVERED: [],
  CANCELLED: [],
};

const CUSTOMER_CANCELLABLE_STATUSES: ShopOrderStatus[] = [
  ShopOrderStatus.PENDING_CONFIRMATION,
  ShopOrderStatus.CONFIRMED,
];

const TERMINAL_SHOP_ORDER_STATUSES: ShopOrderStatus[] = [
  ShopOrderStatus.DELIVERED,
  ShopOrderStatus.CANCELLED,
];

const CUSTOMER_CANCELLABLE_PAYMENT_STATUSES: PaymentStatus[] = [PaymentStatus.UNPAID, PaymentStatus.FAILED];

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shops: ShopsService,
  ) {}

  listMine(userId: string) {
    return this.prisma.parentOrder.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: ORDER_INCLUDE,
    });
  }

  async getMine(userId: string, orderId: string) {
    const order = await this.prisma.parentOrder.findFirst({
      where: { id: orderId, userId },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async cancelMine(userId: string, orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.parentOrder.findFirst({
        where: { id: orderId, userId },
        include: { shopOrders: { include: { items: true } } },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status !== ParentOrderStatus.PLACED) throw new BadRequestException('Order cannot be cancelled');
      if (!CUSTOMER_CANCELLABLE_PAYMENT_STATUSES.includes(order.paymentStatus)) {
        throw new BadRequestException('Authorized or paid orders require payment reversal before cancellation');
      }
      if (order.shopOrders.some((shopOrder) => !CUSTOMER_CANCELLABLE_STATUSES.includes(shopOrder.status))) {
        throw new BadRequestException('Order can no longer be cancelled');
      }

      for (const shopOrder of order.shopOrders) {
        if (shopOrder.status === ShopOrderStatus.CANCELLED) continue;
        await this.releaseInventory(tx, order.id, shopOrder.items);
        await tx.shopOrder.update({ where: { id: shopOrder.id }, data: { status: ShopOrderStatus.CANCELLED } });
      }
      await tx.parentOrder.update({ where: { id: order.id }, data: { status: ParentOrderStatus.CANCELLED } });
      return tx.parentOrder.findUniqueOrThrow({ where: { id: order.id }, include: ORDER_INCLUDE });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async listForShop(ownerId: string, shopId: string) {
    await this.shops.assertOwner(shopId, ownerId);
    return this.prisma.shopOrder.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        parentOrder: {
          select: { id: true, orderNumber: true, paymentStatus: true, shippingAddress: true, createdAt: true },
        },
      },
    });
  }

  async updateShopOrderStatus(ownerId: string, shopOrderId: string, nextStatus: ShopOrderStatus) {
    return this.prisma.$transaction(async (tx) => {
      const shopOrder = await tx.shopOrder.findUnique({
        where: { id: shopOrderId },
        include: { shop: true, items: true },
      });
      if (!shopOrder) throw new NotFoundException('Shop order not found');
      if (shopOrder.shop.ownerId !== ownerId) throw new ForbiddenException('Not your shop order');
      if (!SHOP_ORDER_TRANSITIONS[shopOrder.status].includes(nextStatus)) {
        throw new BadRequestException(`Invalid shop order transition: ${shopOrder.status} -> ${nextStatus}`);
      }

      const changed = await tx.shopOrder.updateMany({
        where: { id: shopOrder.id, status: shopOrder.status },
        data: { status: nextStatus },
      });
      if (changed.count !== 1) throw new ConflictException('Shop order changed concurrently');

      if (nextStatus === ShopOrderStatus.CANCELLED) {
        await this.releaseInventory(tx, shopOrder.parentOrderId, shopOrder.items);
      } else if (nextStatus === ShopOrderStatus.DELIVERED) {
        await this.sellInventory(tx, shopOrder.parentOrderId, shopOrder.items);
      }

      await this.updateParentStatus(tx, shopOrder.parentOrderId);
      return tx.shopOrder.findUniqueOrThrow({
        where: { id: shopOrder.id },
        include: { items: true, parentOrder: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async releaseInventory(tx: Prisma.TransactionClient, referenceId: string, items: Array<{ productId: string; quantity: number }>) {
    for (const item of items) {
      const inventory = await tx.inventory.findUnique({ where: { productId: item.productId } });
      if (!inventory) throw new ConflictException('Inventory no longer exists');
      const updated = await tx.inventory.updateMany({
        where: { id: inventory.id, reserved: { gte: item.quantity } },
        data: { reserved: { decrement: item.quantity } },
      });
      if (updated.count !== 1) throw new ConflictException('Reserved inventory is inconsistent');
      await tx.inventoryLedger.create({
        data: {
          inventoryId: inventory.id,
          deltaReserve: -item.quantity,
          reason: InventoryReason.ORDER_RELEASED,
          referenceId,
        },
      });
    }
  }

  private async sellInventory(tx: Prisma.TransactionClient, referenceId: string, items: Array<{ productId: string; quantity: number }>) {
    for (const item of items) {
      const inventory = await tx.inventory.findUnique({ where: { productId: item.productId } });
      if (!inventory) throw new ConflictException('Inventory no longer exists');
      const updated = await tx.inventory.updateMany({
        where: { id: inventory.id, reserved: { gte: item.quantity }, onHand: { gte: item.quantity } },
        data: {
          onHand: { decrement: item.quantity },
          reserved: { decrement: item.quantity },
          sold: { increment: item.quantity },
        },
      });
      if (updated.count !== 1) throw new ConflictException('Reserved inventory is inconsistent');
      await tx.inventoryLedger.create({
        data: {
          inventoryId: inventory.id,
          deltaOnHand: -item.quantity,
          deltaReserve: -item.quantity,
          deltaSold: item.quantity,
          reason: InventoryReason.ORDER_SOLD,
          referenceId,
        },
      });
    }
  }

  private async updateParentStatus(tx: Prisma.TransactionClient, parentOrderId: string) {
    const shopOrders = await tx.shopOrder.findMany({ where: { parentOrderId }, select: { status: true } });
    const allTerminal = shopOrders.every((order) => TERMINAL_SHOP_ORDER_STATUSES.includes(order.status));
    if (!allTerminal) return;
    const status = shopOrders.every((order) => order.status === ShopOrderStatus.CANCELLED)
      ? ParentOrderStatus.CANCELLED
      : ParentOrderStatus.COMPLETED;
    await tx.parentOrder.update({ where: { id: parentOrderId }, data: { status } });
  }
}
