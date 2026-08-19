import 'dotenv/config';
import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  CouponScope,
  CouponType,
  InteractionType,
  InventoryReason,
  PaymentMethod,
  PaymentStatus,
  ProductStatus,
  ShopOrderStatus,
  ShopStatus,
  UserRole,
} from '@prisma/client';
import { describe, expect, it } from '@jest/globals';
import { PrismaService } from '../../prisma/prisma.service';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { CartService } from '../cart/cart.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { ShopsService } from '../shops/shops.service';
import { CheckoutService } from './checkout.service';

describe('Phase 3 commerce flow integration', () => {
  it('quotes, splits, commits idempotently, and transitions orders and payment with inventory ledgers', async () => {
    const prisma = new PrismaService();
    const recommendations = new RecommendationsService(prisma);
    const cart = new CartService(prisma, recommendations);
    const checkout = new CheckoutService(prisma, recommendations);
    const orders = new OrdersService(prisma, new ShopsService(prisma));
    const payments = new PaymentsService(prisma);
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const userIds: string[] = [];
    const shopIds: string[] = [];
    const productIds: string[] = [];
    let categoryId: number | undefined;

    await prisma.$connect();
    try {
      const [customer, vendorA, vendorB, admin] = await Promise.all([
        prisma.user.create({
          data: {
            email: `phase3-customer-${suffix}@example.com`,
            passwordHash: 'not-used',
            fullName: 'Phase 3 Customer',
          },
        }),
        prisma.user.create({
          data: {
            email: `phase3-vendor-a-${suffix}@example.com`,
            passwordHash: 'not-used',
            fullName: 'Phase 3 Vendor A',
            role: UserRole.VENDOR,
          },
        }),
        prisma.user.create({
          data: {
            email: `phase3-vendor-b-${suffix}@example.com`,
            passwordHash: 'not-used',
            fullName: 'Phase 3 Vendor B',
            role: UserRole.VENDOR,
          },
        }),
        prisma.user.create({
          data: {
            email: `phase3-admin-${suffix}@example.com`,
            passwordHash: 'not-used',
            fullName: 'Phase 3 Admin',
            role: UserRole.ADMIN,
          },
        }),
      ]);
      userIds.push(customer.id, vendorA.id, vendorB.id, admin.id);

      const address = await prisma.userAddress.create({
        data: {
          userId: customer.id,
          recipient: 'Test Customer',
          phone: '0900000000',
          line1: '1 Test Street',
          ward: 'Test Ward',
          district: 'Test District',
          city: 'Ho Chi Minh City',
        },
      });
      const [shopA, shopB] = await Promise.all([
        prisma.shop.create({
          data: {
            ownerId: vendorA.id,
            name: 'Phase 3 Shop A',
            slug: `phase3-shop-a-${suffix}`,
            status: ShopStatus.APPROVED,
          },
        }),
        prisma.shop.create({
          data: {
            ownerId: vendorB.id,
            name: 'Phase 3 Shop B',
            slug: `phase3-shop-b-${suffix}`,
            status: ShopStatus.APPROVED,
          },
        }),
      ]);
      shopIds.push(shopA.id, shopB.id);
      const category = await prisma.category.create({
        data: { name: 'Phase 3 Category', slug: `phase3-category-${suffix}` },
      });
      categoryId = category.id;

      const [productA, productB, productC] = await Promise.all([
        prisma.product.create({
          data: {
            shopId: shopA.id,
            categoryId: category.id,
            name: 'Phase 3 Product A',
            slug: `phase3-product-a-${suffix}`,
            price: 100000,
            images: ['https://example.com/phase3-product-a.jpg'],
            status: ProductStatus.ACTIVE,
            inventory: { create: { onHand: 10 } },
          },
        }),
        prisma.product.create({
          data: {
            shopId: shopB.id,
            categoryId: category.id,
            name: 'Phase 3 Product B',
            slug: `phase3-product-b-${suffix}`,
            price: 200000,
            status: ProductStatus.ACTIVE,
            inventory: { create: { onHand: 5 } },
          },
        }),
        prisma.product.create({
          data: {
            shopId: shopA.id,
            categoryId: category.id,
            name: 'Phase 3 Product C',
            slug: `phase3-product-c-${suffix}`,
            price: 50000,
            status: ProductStatus.ACTIVE,
            inventory: { create: { onHand: 3 } },
          },
        }),
      ]);
      productIds.push(productA.id, productB.id, productC.id);

      await expect(cart.addItem(customer.id, { productId: productB.id, quantity: 6 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await cart.addItem(customer.id, { productId: productA.id, quantity: 2 });
      const cartView = await cart.addItem(customer.id, { productId: productB.id, quantity: 1 });
      expect(cartView.itemCount).toBe(3);
      expect(cartView.subtotal.toString()).toBe('400000');
      const cartWithUnselectedItem = await cart.addItem(customer.id, { productId: productC.id, quantity: 1 });
      const selectedCartItemIds = cartWithUnselectedItem.items
        .filter((item) => item.productId !== productC.id)
        .map((item) => item.id);
      await expect(checkout.quote(customer.id, { cartItemIds: [productA.id] })).rejects.toBeInstanceOf(
        BadRequestException,
      );

      const fixedCouponCode = `WELCOME2K-${suffix}`.toUpperCase();
      await prisma.coupon.create({
        data: {
          code: fixedCouponCode,
          scope: CouponScope.GLOBAL,
          type: CouponType.FIXED_AMOUNT,
          value: 2000,
        },
      });
      const fixedCouponQuote = await checkout.quote(customer.id, {
        couponCode: fixedCouponCode,
        cartItemIds: selectedCartItemIds,
      });
      expect(fixedCouponQuote.discount.toString()).toBe('2000');
      expect(fixedCouponQuote.total.toString()).toBe('458000');

      await prisma.coupon.create({
        data: {
          code: `PHASE3-${suffix}`.toUpperCase(),
          scope: CouponScope.GLOBAL,
          type: CouponType.PERCENTAGE,
          value: 10,
          maxDiscount: 50000,
          usageLimit: 1,
        },
      });
      const couponCode = `phase3-${suffix}`;
      const quote = await checkout.quote(customer.id, { couponCode, cartItemIds: selectedCartItemIds });
      expect(quote.shops).toHaveLength(2);
      expect(quote.subtotal.toString()).toBe('400000');
      expect(quote.discount.toString()).toBe('40000');
      expect(quote.shipping.toString()).toBe('60000');
      expect(quote.total.toString()).toBe('420000');

      const request = {
        addressId: address.id,
        paymentMethod: PaymentMethod.COD,
        couponCode,
        cartItemIds: selectedCartItemIds,
        idempotencyKey: `phase3-checkout-${suffix}`,
      };
      const order = await checkout.commit(customer.id, request);
      expect(order.shopOrders).toHaveLength(2);
      expect(order.payments).toHaveLength(1);
      expect(order.payments[0].amount.toString()).toBe('420000');
      const snapshots = order.shopOrders.flatMap((shopOrder) => shopOrder.items);
      expect(snapshots.map((item) => item.productName)).toEqual(
        expect.arrayContaining(['Phase 3 Product A', 'Phase 3 Product B']),
      );
      expect(snapshots.find((item) => item.productId === productA.id)).toEqual(expect.objectContaining({
        productName: 'Phase 3 Product A',
        productImage: 'https://example.com/phase3-product-a.jpg',
        unitPrice: expect.objectContaining({}),
      }));
      expect(snapshots.find((item) => item.productId === productA.id)?.unitPrice.toString()).toBe('100000');

      const replay = await checkout.commit(customer.id, request);
      expect(replay.id).toBe(order.id);
      const purchaseSignals = await prisma.userInteraction.findMany({
        where: { userId: customer.id, type: InteractionType.PURCHASE },
        select: { productId: true, count: true },
      });
      expect(purchaseSignals).toEqual(expect.arrayContaining([
        { productId: productA.id, count: 1 },
        { productId: productB.id, count: 1 },
      ]));
      expect(purchaseSignals).toHaveLength(2);
      await expect(
        checkout.commit(customer.id, { ...request, paymentMethod: PaymentMethod.BANK_TRANSFER }),
      ).rejects.toBeInstanceOf(ConflictException);

      const storedCart = await cart.getCart(customer.id);
      expect(storedCart.items).toHaveLength(1);
      expect(storedCart.items[0].productId).toBe(productC.id);
      const inventories = await prisma.inventory.findMany({
        where: { productId: { in: [productA.id, productB.id] } },
        include: { ledger: { where: { referenceId: order.id } } },
        orderBy: { productId: 'asc' },
      });
      expect(inventories.map((inventory) => inventory.reserved).sort((a, b) => a - b)).toEqual([1, 2]);
      expect(inventories.every((inventory) => inventory.ledger[0]?.reason === InventoryReason.ORDER_RESERVED)).toBe(true);

      const shopOrderA = order.shopOrders.find((shopOrder) => shopOrder.shopId === shopA.id)!;
      const shopOrderB = order.shopOrders.find((shopOrder) => shopOrder.shopId === shopB.id)!;
      await orders.updateShopOrderStatus(vendorA.id, shopOrderA.id, ShopOrderStatus.CANCELLED);
      await expect(
        orders.updateShopOrderStatus(vendorB.id, shopOrderB.id, ShopOrderStatus.DELIVERED),
      ).rejects.toBeInstanceOf(BadRequestException);
      await orders.updateShopOrderStatus(vendorB.id, shopOrderB.id, ShopOrderStatus.CONFIRMED);
      await orders.updateShopOrderStatus(vendorB.id, shopOrderB.id, ShopOrderStatus.PACKING);
      await orders.updateShopOrderStatus(vendorB.id, shopOrderB.id, ShopOrderStatus.READY_TO_HANDOFF);
      await orders.updateShopOrderStatus(vendorB.id, shopOrderB.id, ShopOrderStatus.DELIVERED);

      const completed = await orders.getMine(customer.id, order.id);
      expect(completed.status).toBe('COMPLETED');
      expect(completed.shopOrders.flatMap((shopOrder) => shopOrder.items).find((item) => item.productId === productA.id)?.product.slug)
        .toBe(productA.slug);
      const finalInventoryA = await prisma.inventory.findUniqueOrThrow({ where: { productId: productA.id } });
      const finalInventoryB = await prisma.inventory.findUniqueOrThrow({ where: { productId: productB.id } });
      expect(finalInventoryA.reserved).toBe(0);
      expect(finalInventoryA.onHand).toBe(10);
      expect(finalInventoryB.reserved).toBe(0);
      expect(finalInventoryB.onHand).toBe(4);
      expect(finalInventoryB.sold).toBe(1);

      const paymentId = order.payments[0].id;
      await expect(
        payments.updateStatus(admin.id, paymentId, { status: PaymentStatus.PAID }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await payments.updateStatus(admin.id, paymentId, {
        status: PaymentStatus.AUTHORIZED,
        note: 'Payment authorized by integration test',
      });
      const paid = await payments.updateStatus(admin.id, paymentId, { status: PaymentStatus.PAID });
      expect(paid.statusHistory).toHaveLength(2);
      expect(paid.paidAt).not.toBeNull();
      const paidOrder = await prisma.parentOrder.findUniqueOrThrow({ where: { id: order.id } });
      expect(paidOrder.paymentStatus).toBe(PaymentStatus.PAID);
    } finally {
      await prisma.parentOrder.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.coupon.deleteMany({ where: { code: { contains: suffix.toUpperCase() } } });
      await prisma.cartItem.deleteMany({ where: { productId: { in: productIds } } });
      await prisma.product.deleteMany({ where: { id: { in: productIds } } });
      await prisma.shop.deleteMany({ where: { id: { in: shopIds } } });
      if (categoryId) await prisma.category.delete({ where: { id: categoryId } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.$disconnect();
    }
  });

  it('allows only one concurrent checkout when stock cannot satisfy both carts', async () => {
    const prisma = new PrismaService();
    const recommendations = new RecommendationsService(prisma);
    const cart = new CartService(prisma, recommendations);
    const checkout = new CheckoutService(prisma, recommendations);
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const userIds: string[] = [];
    let shopId: string | undefined;
    let categoryId: number | undefined;
    let productId: string | undefined;

    await prisma.$connect();
    try {
      const [customerA, customerB, vendor] = await Promise.all([
        prisma.user.create({
          data: { email: `race-a-${suffix}@example.com`, passwordHash: 'not-used', fullName: 'Race A' },
        }),
        prisma.user.create({
          data: { email: `race-b-${suffix}@example.com`, passwordHash: 'not-used', fullName: 'Race B' },
        }),
        prisma.user.create({
          data: {
            email: `race-vendor-${suffix}@example.com`,
            passwordHash: 'not-used',
            fullName: 'Race Vendor',
            role: UserRole.VENDOR,
          },
        }),
      ]);
      userIds.push(customerA.id, customerB.id, vendor.id);
      const shop = await prisma.shop.create({
        data: {
          ownerId: vendor.id,
          name: 'Race Shop',
          slug: `race-shop-${suffix}`,
          status: ShopStatus.APPROVED,
        },
      });
      shopId = shop.id;
      const category = await prisma.category.create({
        data: { name: 'Race Category', slug: `race-category-${suffix}` },
      });
      categoryId = category.id;
      const product = await prisma.product.create({
        data: {
          shopId: shop.id,
          categoryId: category.id,
          name: 'Scarce Product',
          slug: `scarce-product-${suffix}`,
          price: 100000,
          status: ProductStatus.ACTIVE,
          inventory: { create: { onHand: 5 } },
        },
      });
      productId = product.id;
      const [addressA, addressB] = await Promise.all([
        prisma.userAddress.create({
          data: {
            userId: customerA.id,
            recipient: 'Race A',
            phone: '0900000001',
            line1: '1 Race Street',
            ward: 'Ward',
            district: 'District',
            city: 'City',
          },
        }),
        prisma.userAddress.create({
          data: {
            userId: customerB.id,
            recipient: 'Race B',
            phone: '0900000002',
            line1: '2 Race Street',
            ward: 'Ward',
            district: 'District',
            city: 'City',
          },
        }),
      ]);
      await Promise.all([
        cart.addItem(customerA.id, { productId: product.id, quantity: 4 }),
        cart.addItem(customerB.id, { productId: product.id, quantity: 4 }),
      ]);

      const results = await Promise.allSettled([
        checkout.commit(customerA.id, {
          addressId: addressA.id,
          paymentMethod: PaymentMethod.COD,
          idempotencyKey: `race-checkout-a-${suffix}`,
        }),
        checkout.commit(customerB.id, {
          addressId: addressB.id,
          paymentMethod: PaymentMethod.COD,
          idempotencyKey: `race-checkout-b-${suffix}`,
        }),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);

      const inventory = await prisma.inventory.findUniqueOrThrow({
        where: { productId: product.id },
        include: { ledger: { where: { reason: InventoryReason.ORDER_RESERVED } } },
      });
      expect(inventory.reserved).toBe(4);
      expect(inventory.onHand - inventory.reserved).toBe(1);
      expect(inventory.ledger).toHaveLength(1);
      expect(await prisma.parentOrder.count({ where: { userId: { in: [customerA.id, customerB.id] } } })).toBe(1);
    } finally {
      await prisma.parentOrder.deleteMany({ where: { userId: { in: userIds } } });
      if (productId) await prisma.cartItem.deleteMany({ where: { productId } });
      if (productId) await prisma.product.delete({ where: { id: productId } });
      if (shopId) await prisma.shop.delete({ where: { id: shopId } });
      if (categoryId) await prisma.category.delete({ where: { id: categoryId } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.$disconnect();
    }
  });
});
