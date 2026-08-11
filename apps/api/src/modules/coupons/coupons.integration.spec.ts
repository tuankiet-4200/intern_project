import 'dotenv/config';
import { BadRequestException } from '@nestjs/common';
import { CouponScope, CouponType, PaymentMethod, ProductStatus, ShopStatus, UserRole } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';
import { PrismaService } from '../../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { CheckoutService } from '../checkout/checkout.service';
import { CouponsService } from './coupons.service';

describe('Coupon campaign integration', () => {
  it('manages campaigns and enforces per-customer limits during checkout', async () => {
    const prisma = new PrismaService();
    const coupons = new CouponsService(prisma);
    const cart = new CartService(prisma);
    const checkout = new CheckoutService(prisma);
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const userIds: string[] = [];
    let shopId: string | undefined;
    let categoryId: number | undefined;
    let productId: string | undefined;
    const couponIds: string[] = [];

    await prisma.$connect();
    try {
      const [customerA, customerB, vendor, otherVendor] = await Promise.all([
        prisma.user.create({
          data: { email: `coupon-a-${suffix}@example.com`, passwordHash: 'unused', fullName: 'Coupon A' },
        }),
        prisma.user.create({
          data: { email: `coupon-b-${suffix}@example.com`, passwordHash: 'unused', fullName: 'Coupon B' },
        }),
        prisma.user.create({
          data: {
            email: `coupon-vendor-${suffix}@example.com`,
            passwordHash: 'unused',
            fullName: 'Coupon Vendor',
            role: UserRole.VENDOR,
          },
        }),
        prisma.user.create({
          data: {
            email: `coupon-other-vendor-${suffix}@example.com`,
            passwordHash: 'unused',
            fullName: 'Other Coupon Vendor',
            role: UserRole.VENDOR,
          },
        }),
      ]);
      userIds.push(customerA.id, customerB.id, vendor.id, otherVendor.id);
      const shop = await prisma.shop.create({
        data: {
          ownerId: vendor.id,
          name: 'Coupon Shop',
          slug: `coupon-shop-${suffix}`,
          status: ShopStatus.APPROVED,
        },
      });
      shopId = shop.id;
      const category = await prisma.category.create({
        data: { name: 'Coupon Category', slug: `coupon-category-${suffix}` },
      });
      categoryId = category.id;
      const product = await prisma.product.create({
        data: {
          shopId: shop.id,
          categoryId: category.id,
          name: 'Coupon Product',
          slug: `coupon-product-${suffix}`,
          price: 100000,
          status: ProductStatus.ACTIVE,
          inventory: { create: { onHand: 10 } },
        },
      });
      productId = product.id;
      const [addressA, addressB] = await Promise.all([
        prisma.userAddress.create({
          data: { userId: customerA.id, recipient: 'A', phone: '0900000001', line1: '1 A', ward: 'W', district: 'D', city: 'C' },
        }),
        prisma.userAddress.create({
          data: { userId: customerB.id, recipient: 'B', phone: '0900000002', line1: '2 B', ward: 'W', district: 'D', city: 'C' },
        }),
      ]);

      await expect(coupons.createForVendor(vendor.id, {
        code: `vendor-global-${suffix}`,
        scope: CouponScope.GLOBAL,
        type: CouponType.PERCENTAGE,
        value: '5',
      })).rejects.toThrow('Vendor coupons must use SHOP scope');
      await expect(coupons.createForVendor(otherVendor.id, {
        code: `not-owned-${suffix}`,
        scope: CouponScope.SHOP,
        shopId: shop.id,
        type: CouponType.PERCENTAGE,
        value: '5',
      })).rejects.toThrow('Not your shop');
      const vendorCampaign = await coupons.createForVendor(vendor.id, {
        code: `vendor-${suffix}`,
        scope: CouponScope.SHOP,
        shopId: shop.id,
        type: CouponType.FIXED_AMOUNT,
        value: '5000',
        usageLimit: 5,
        perUserLimit: 2,
      });
      couponIds.push(vendorCampaign.id);
      const vendorPage = await coupons.listForVendor(vendor.id, { page: 1, limit: 20 });
      expect(vendorPage.data.map((coupon) => coupon.id)).toContain(vendorCampaign.id);
      expect((await coupons.listForVendor(otherVendor.id, { page: 1, limit: 20 })).total).toBe(0);
      expect((await coupons.availableForUser(customerA.id)).map((coupon) => coupon.id)).toContain(vendorCampaign.id);

      await expect(coupons.create({
        code: `BAD-${suffix}`,
        scope: CouponScope.GLOBAL,
        type: CouponType.PERCENTAGE,
        value: '101',
      })).rejects.toBeInstanceOf(BadRequestException);
      await expect(coupons.create({
        code: `OLD-${suffix}`,
        scope: CouponScope.GLOBAL,
        type: CouponType.FIXED_AMOUNT,
        value: '1000',
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      })).rejects.toThrow('Expired coupon cannot be created as active');

      const campaign = await coupons.create({
        code: `account-${suffix}`,
        scope: CouponScope.GLOBAL,
        type: CouponType.PERCENTAGE,
        value: '10',
        maxDiscount: '20000',
        usageLimit: 3,
        perUserLimit: 1,
      });
      couponIds.push(campaign.id);
      expect(campaign.code).toBe(`ACCOUNT-${suffix}`.toUpperCase());

      await cart.addItem(customerA.id, { productId: product.id, quantity: 1 });
      const concurrentCheckout = await Promise.allSettled([
        checkout.commit(customerA.id, {
          addressId: addressA.id,
          paymentMethod: PaymentMethod.COD,
          couponCode: campaign.code,
          idempotencyKey: `coupon-first-a-${suffix}`,
        }),
        checkout.commit(customerA.id, {
          addressId: addressA.id,
          paymentMethod: PaymentMethod.COD,
          couponCode: campaign.code,
          idempotencyKey: `coupon-first-b-${suffix}`,
        }),
      ]);
      expect(concurrentCheckout.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(concurrentCheckout.filter((result) => result.status === 'rejected')).toHaveLength(1);
      const firstOrderResult = concurrentCheckout.find((result) => result.status === 'fulfilled')!;
      if (firstOrderResult.status !== 'fulfilled') throw new Error('Expected one coupon checkout to succeed');
      const firstOrder = firstOrderResult.value;
      expect(firstOrder.discountAmount.toString()).toBe('10000');
      expect(await prisma.couponUsage.count({ where: { couponId: campaign.id, userId: customerA.id } })).toBe(1);

      await cart.addItem(customerA.id, { productId: product.id, quantity: 1 });
      await expect(checkout.quote(customerA.id, { couponCode: campaign.code })).rejects.toThrow(
        'Coupon usage limit reached for this account',
      );
      const availableAfterUse = await coupons.availableForUser(customerA.id);
      expect(availableAfterUse.map((coupon) => coupon.id)).not.toContain(campaign.id);
      expect(availableAfterUse.map((coupon) => coupon.id)).toContain(vendorCampaign.id);

      await cart.addItem(customerB.id, { productId: product.id, quantity: 1 });
      const secondQuote = await checkout.quote(customerB.id, { couponCode: campaign.code });
      expect(secondQuote.discount.toString()).toBe('10000');
      await checkout.commit(customerB.id, {
        addressId: addressB.id,
        paymentMethod: PaymentMethod.COD,
        couponCode: campaign.code,
        idempotencyKey: `coupon-second-${suffix}`,
      });

      await expect(coupons.update(campaign.id, { value: '20' })).rejects.toThrow(
        'cannot change after coupon usage',
      );
      const updated = await coupons.update(campaign.id, { minOrderAmount: '50000', usageLimit: 4 });
      expect(updated.minOrderAmount?.toString()).toBe('50000');
      expect(updated.usageLimit).toBe(4);

      const page = await coupons.list({ page: 1, limit: 20, search: `account-${suffix}` });
      expect(page.total).toBe(1);
      expect(page.data[0]._count.usages).toBe(2);

      const expired = await coupons.create({
        code: `expired-${suffix}`,
        scope: CouponScope.SHOP,
        shopId: shop.id,
        type: CouponType.FIXED_AMOUNT,
        value: '5000',
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
        isActive: false,
      });
      couponIds.push(expired.id);
      await expect(coupons.updateStatus(expired.id, true)).rejects.toThrow('Expired coupon cannot be activated');
    } finally {
      await prisma.parentOrder.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.coupon.deleteMany({ where: { id: { in: couponIds } } });
      if (productId) await prisma.cartItem.deleteMany({ where: { productId } });
      if (productId) await prisma.product.delete({ where: { id: productId } });
      if (shopId) await prisma.shop.delete({ where: { id: shopId } });
      if (categoryId) await prisma.category.delete({ where: { id: categoryId } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.$disconnect();
    }
  });
});
