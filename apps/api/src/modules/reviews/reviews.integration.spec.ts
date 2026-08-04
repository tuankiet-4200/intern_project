import 'dotenv/config';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ParentOrderStatus, ProductStatus, ShopOrderStatus, ShopStatus, UserRole } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';
import { PrismaService } from '../../prisma/prisma.service';
import { ReviewsService } from './reviews.service';

describe('ReviewsService integration', () => {
  it('allows only the buyer to review a delivered order item once', async () => {
    const prisma = new PrismaService();
    const reviews = new ReviewsService(prisma);
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const userIds: string[] = [];
    let shopId: string | undefined;
    let categoryId: number | undefined;
    let productId: string | undefined;
    let orderId: string | undefined;

    await prisma.$connect();
    try {
      const [customer, otherCustomer, vendor] = await Promise.all([
        prisma.user.create({ data: { email: `review-customer-${suffix}@example.com`, passwordHash: 'x', fullName: 'Review Customer' } }),
        prisma.user.create({ data: { email: `review-other-${suffix}@example.com`, passwordHash: 'x', fullName: 'Other Customer' } }),
        prisma.user.create({ data: { email: `review-vendor-${suffix}@example.com`, passwordHash: 'x', fullName: 'Review Vendor', role: UserRole.VENDOR } }),
      ]);
      userIds.push(customer.id, otherCustomer.id, vendor.id);
      const shop = await prisma.shop.create({ data: { ownerId: vendor.id, name: 'Review Shop', slug: `review-shop-${suffix}`, status: ShopStatus.APPROVED } });
      shopId = shop.id;
      const category = await prisma.category.create({ data: { name: 'Review Category', slug: `review-category-${suffix}` } });
      categoryId = category.id;
      const product = await prisma.product.create({
        data: { shopId: shop.id, categoryId: category.id, name: 'Reviewed Product', slug: `reviewed-product-${suffix}`, price: 100, status: ProductStatus.ACTIVE, inventory: { create: { onHand: 1, sold: 1 } } },
      });
      productId = product.id;
      const order = await prisma.parentOrder.create({
        data: {
          userId: customer.id,
          orderNumber: `REVIEW-${suffix}`,
          status: ParentOrderStatus.COMPLETED,
          subtotalAmount: 100,
          totalAmount: 100,
          shippingAddress: {},
          shopOrders: {
            create: {
              shopId: shop.id,
              status: ShopOrderStatus.DELIVERED,
              subtotalAmount: 100,
              totalAmount: 100,
              items: { create: { productId: product.id, productName: product.name, unitPrice: 100, quantity: 1, lineTotal: 100 } },
            },
          },
        },
        include: { shopOrders: { include: { items: true } } },
      });
      orderId = order.id;
      const orderItemId = order.shopOrders[0].items[0].id;

      await expect(reviews.create(otherCustomer.id, { orderItemId, rating: 5 })).rejects.toBeInstanceOf(NotFoundException);
      const review = await reviews.create(customer.id, { orderItemId, rating: 5, comment: '  Excellent  ' });
      expect(review.comment).toBe('Excellent');
      await expect(reviews.create(customer.id, { orderItemId, rating: 4 })).rejects.toBeInstanceOf(ConflictException);

      const publicReviews = await reviews.listForProduct(product.id, { page: 1, limit: 20 });
      expect(publicReviews.total).toBe(1);
      expect(publicReviews.averageRating).toBe(5);
      await expect(reviews.update(otherCustomer.id, review.id, { rating: 1 })).rejects.toBeInstanceOf(NotFoundException);
      const updated = await reviews.update(customer.id, review.id, { rating: 4 });
      expect(updated.rating).toBe(4);

      await prisma.shopOrder.update({ where: { id: order.shopOrders[0].id }, data: { status: ShopOrderStatus.CONFIRMED } });
      await prisma.review.delete({ where: { id: review.id } });
      await expect(reviews.create(customer.id, { orderItemId, rating: 5 })).rejects.toBeInstanceOf(BadRequestException);
    } finally {
      if (orderId) await prisma.parentOrder.delete({ where: { id: orderId } });
      if (productId) await prisma.product.delete({ where: { id: productId } });
      if (shopId) await prisma.shop.delete({ where: { id: shopId } });
      if (categoryId) await prisma.category.delete({ where: { id: categoryId } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.$disconnect();
    }
  });
});
