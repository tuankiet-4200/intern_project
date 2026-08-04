import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CouponScope,
  CouponType,
  InventoryReason,
  PaymentStatus,
  Prisma,
  ProductStatus,
  ShopStatus,
} from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CheckoutCommitDto, CheckoutQuoteDto } from './dto/checkout.dto';

type DbClient = PrismaService | Prisma.TransactionClient;
type PricedItem = Awaited<ReturnType<CheckoutService['loadCartItems']>>[number];

const ORDER_INCLUDE = {
  shopOrders: {
    orderBy: { createdAt: 'asc' as const },
    include: { shop: { select: { id: true, name: true, slug: true } }, items: true },
  },
  payments: { orderBy: { createdAt: 'asc' as const } },
  couponUsages: { include: { coupon: { select: { code: true, scope: true, type: true } } } },
} as const;

@Injectable()
export class CheckoutService {
  private static readonly MAX_TRANSACTION_ATTEMPTS = 3;

  constructor(private readonly prisma: PrismaService) {}

  async quote(userId: string, dto: CheckoutQuoteDto) {
    const pricing = await this.priceCart(this.prisma, userId, dto.couponCode);
    return this.presentQuote(pricing);
  }

  async commit(userId: string, dto: CheckoutCommitDto) {
    const fingerprint = this.fingerprint(dto);

    for (let attempt = 0; attempt < CheckoutService.MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const existing = await tx.parentOrder.findUnique({
              where: { userId_idempotencyKey: { userId, idempotencyKey: dto.idempotencyKey } },
              include: ORDER_INCLUDE,
            });
            if (existing) {
              if (existing.checkoutFingerprint !== fingerprint) {
                throw new ConflictException('Idempotency key was already used with a different checkout request');
              }
              return existing;
            }

            const address = await tx.userAddress.findFirst({ where: { id: dto.addressId, userId } });
            if (!address) throw new NotFoundException('Shipping address not found');

            const pricing = await this.priceCart(tx, userId, dto.couponCode);
            const parentOrder = await tx.parentOrder.create({
              data: {
                userId,
                orderNumber: `ORD-${randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`,
                idempotencyKey: dto.idempotencyKey,
                checkoutFingerprint: fingerprint,
                subtotalAmount: pricing.subtotal,
                discountAmount: pricing.discount,
                shippingAmount: pricing.shipping,
                totalAmount: pricing.total,
                shippingAddress: {
                  recipient: address.recipient,
                  phone: address.phone,
                  line1: address.line1,
                  ward: address.ward,
                  district: address.district,
                  city: address.city,
                },
              },
            });

            for (const group of pricing.groups) {
              await tx.shopOrder.create({
                data: {
                  parentOrderId: parentOrder.id,
                  shopId: group.shop.id,
                  subtotalAmount: group.subtotal,
                  discountAmount: group.discount,
                  shippingAmount: group.shipping,
                  totalAmount: group.total,
                  items: {
                    create: group.items.map((item) => ({
                      productId: item.product.id,
                      productName: item.product.name,
                      productImage: item.product.images[0],
                      unitPrice: item.product.price,
                      quantity: item.quantity,
                      lineTotal: item.lineTotal,
                    })),
                  },
                },
              });
            }

            for (const item of pricing.items) {
              const inventory = item.product.inventory!;
              const reserved = await tx.inventory.updateMany({
                where: {
                  id: inventory.id,
                  onHand: inventory.onHand,
                  reserved: inventory.reserved,
                },
                data: { reserved: { increment: item.quantity } },
              });
              if (reserved.count !== 1) throw new ConflictException('Inventory changed during checkout; retry');
              await tx.inventoryLedger.create({
                data: {
                  inventoryId: inventory.id,
                  deltaReserve: item.quantity,
                  reason: InventoryReason.ORDER_RESERVED,
                  referenceId: parentOrder.id,
                },
              });
            }

            if (pricing.coupon) {
              const claimed = await tx.coupon.updateMany({
                where: { id: pricing.coupon.id, usedCount: pricing.coupon.usedCount },
                data: { usedCount: { increment: 1 } },
              });
              if (claimed.count !== 1) throw new ConflictException('Coupon usage changed; retry checkout');
              await tx.couponUsage.create({
                data: {
                  couponId: pricing.coupon.id,
                  userId,
                  parentOrderId: parentOrder.id,
                  discountAmount: pricing.discount,
                },
              });
            }

            await tx.payment.create({
              data: {
                parentOrderId: parentOrder.id,
                method: dto.paymentMethod,
                status: PaymentStatus.UNPAID,
                amount: pricing.total,
              },
            });

            await tx.cartItem.deleteMany({
              where: { id: { in: pricing.items.map((item) => item.id) } },
            });

            return tx.parentOrder.findUniqueOrThrow({
              where: { id: parentOrder.id },
              include: ORDER_INCLUDE,
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (this.isRetryable(error) && attempt + 1 < CheckoutService.MAX_TRANSACTION_ATTEMPTS) continue;
        throw error;
      }
    }

    throw new ConflictException('Checkout could not be completed; please retry');
  }

  private async priceCart(client: DbClient, userId: string, couponCode?: string) {
    const items = await this.loadCartItems(client, userId);
    if (items.length === 0) throw new BadRequestException('Cart is empty');

    const invalidItems: Array<{ itemId: string; productId: string; errors: string[] }> = [];
    for (const item of items) {
      const errors: string[] = [];
      const inventory = item.product.inventory;
      const available = inventory ? inventory.onHand - inventory.reserved : 0;
      if (item.product.status !== ProductStatus.ACTIVE) errors.push('Product is not active');
      if (item.product.shop.status !== ShopStatus.APPROVED) errors.push('Shop is not approved');
      if (available < item.quantity) errors.push(`Only ${available} item(s) are available`);
      if (errors.length) invalidItems.push({ itemId: item.id, productId: item.productId, errors });
    }
    if (invalidItems.length) throw new BadRequestException({ message: 'Cart contains invalid items', items: invalidItems });

    const groups = this.groupItems(items);
    const subtotal = groups.reduce((sum, group) => sum.add(group.subtotal), new Prisma.Decimal(0));
    const shippingPerShop = new Prisma.Decimal(process.env.SHIPPING_FEE_PER_SHOP ?? 30000);
    const shipping = shippingPerShop.mul(groups.length);
    const coupon = couponCode ? await this.validateCoupon(client, userId, couponCode, subtotal, groups) : null;
    const discount = coupon ? this.calculateDiscount(coupon, subtotal, groups) : new Prisma.Decimal(0);
    const allocations = this.allocateDiscount(groups, discount, subtotal, coupon?.scope, coupon?.shopId);
    const pricedGroups = groups.map((group, index) => ({
      ...group,
      discount: allocations[index],
      shipping: shippingPerShop,
      total: group.subtotal.sub(allocations[index]).add(shippingPerShop),
    }));

    return {
      items,
      groups: pricedGroups,
      subtotal,
      shipping,
      discount,
      total: subtotal.sub(discount).add(shipping),
      coupon,
    };
  }

  private async loadCartItems(client: DbClient, userId: string) {
    const cart = await client.cart.findUnique({
      where: { userId },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            product: {
              include: {
                shop: { select: { id: true, name: true, slug: true, status: true } },
                inventory: true,
              },
            },
          },
        },
      },
    });
    return (cart?.items ?? []).map((item) => ({
      ...item,
      lineTotal: item.product.price.mul(item.quantity),
    }));
  }

  private groupItems(items: PricedItem[]) {
    const groups = new Map<string, { shop: PricedItem['product']['shop']; items: PricedItem[]; subtotal: Prisma.Decimal }>();
    for (const item of items) {
      const group = groups.get(item.product.shop.id) ?? {
        shop: item.product.shop,
        items: [],
        subtotal: new Prisma.Decimal(0),
      };
      group.items.push(item);
      group.subtotal = group.subtotal.add(item.lineTotal);
      groups.set(item.product.shop.id, group);
    }
    return [...groups.values()];
  }

  private async validateCoupon(
    client: DbClient,
    userId: string,
    couponCode: string,
    subtotal: Prisma.Decimal,
    groups: ReturnType<CheckoutService['groupItems']>,
  ) {
    const coupon = await client.coupon.findUnique({ where: { code: couponCode.trim().toUpperCase() } });
    const now = new Date();
    if (!coupon || !coupon.isActive) throw new BadRequestException('Coupon is invalid');
    if (coupon.startsAt && coupon.startsAt > now) throw new BadRequestException('Coupon is not active yet');
    if (coupon.expiresAt && coupon.expiresAt <= now) throw new BadRequestException('Coupon has expired');
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit reached');
    }
    if (coupon.perUserLimit !== null) {
      const userUsageCount = await client.couponUsage.count({ where: { couponId: coupon.id, userId } });
      if (userUsageCount >= coupon.perUserLimit) {
        throw new BadRequestException('Coupon usage limit reached for this account');
      }
    }
    if (coupon.scope === CouponScope.SHOP && !groups.some((group) => group.shop.id === coupon.shopId)) {
      throw new BadRequestException('Coupon does not apply to cart shops');
    }
    const eligibleSubtotal = coupon.scope === CouponScope.SHOP
      ? groups.find((group) => group.shop.id === coupon.shopId)!.subtotal
      : subtotal;
    if (coupon.minOrderAmount && eligibleSubtotal.lessThan(coupon.minOrderAmount)) {
      throw new BadRequestException('Cart does not meet coupon minimum amount');
    }
    return coupon;
  }

  private calculateDiscount(
    coupon: NonNullable<Awaited<ReturnType<CheckoutService['validateCoupon']>>>,
    subtotal: Prisma.Decimal,
    groups: ReturnType<CheckoutService['groupItems']>,
  ) {
    const eligibleSubtotal = coupon.scope === CouponScope.SHOP
      ? groups.find((group) => group.shop.id === coupon.shopId)!.subtotal
      : subtotal;
    let discount = coupon.type === CouponType.PERCENTAGE
      ? eligibleSubtotal.mul(coupon.value).div(100)
      : Prisma.Decimal.min(eligibleSubtotal, coupon.value);
    if (coupon.maxDiscount) discount = Prisma.Decimal.min(discount, coupon.maxDiscount);
    return Prisma.Decimal.min(discount, eligibleSubtotal).toDecimalPlaces(2);
  }

  private allocateDiscount(
    groups: ReturnType<CheckoutService['groupItems']>,
    discount: Prisma.Decimal,
    subtotal: Prisma.Decimal,
    scope?: CouponScope,
    shopId?: string | null,
  ) {
    if (discount.isZero()) return groups.map(() => new Prisma.Decimal(0));
    if (scope === CouponScope.SHOP) {
      return groups.map((group) => group.shop.id === shopId ? discount : new Prisma.Decimal(0));
    }

    let allocated = new Prisma.Decimal(0);
    return groups.map((group, index) => {
      const value = index === groups.length - 1
        ? discount.sub(allocated)
        : discount.mul(group.subtotal).div(subtotal).toDecimalPlaces(2);
      allocated = allocated.add(value);
      return value;
    });
  }

  private presentQuote(pricing: Awaited<ReturnType<CheckoutService['priceCart']>>) {
    return {
      items: pricing.items.map((item) => ({
        itemId: item.id,
        productId: item.productId,
        productName: item.product.name,
        unitPrice: item.product.price,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
        shop: item.product.shop,
      })),
      shops: pricing.groups.map((group) => ({
        shop: group.shop,
        subtotal: group.subtotal,
        discount: group.discount,
        shipping: group.shipping,
        total: group.total,
      })),
      subtotal: pricing.subtotal,
      discount: pricing.discount,
      shipping: pricing.shipping,
      total: pricing.total,
      coupon: pricing.coupon ? { code: pricing.coupon.code, scope: pricing.coupon.scope } : null,
    };
  }

  private fingerprint(dto: CheckoutCommitDto) {
    return createHash('sha256')
      .update(JSON.stringify({
        addressId: dto.addressId,
        paymentMethod: dto.paymentMethod,
        couponCode: dto.couponCode?.trim().toUpperCase() ?? null,
      }))
      .digest('hex');
  }

  private isRetryable(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code);
  }
}
