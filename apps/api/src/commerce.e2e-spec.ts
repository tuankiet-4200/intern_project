import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProductStatus, ShopOrderStatus, UserRole } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import * as request from 'supertest';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { OutboxService } from './modules/notifications/outbox.service';
import { PrismaService } from './prisma/prisma.service';

describe('Complete commerce happy path e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let outbox: OutboxService;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const adminEmail = `commerce-admin-${suffix}@example.com`;
  const vendorEmail = `commerce-vendor-${suffix}@example.com`;
  const customerEmail = `commerce-customer-${suffix}@example.com`;
  const userIds: string[] = [];
  let shopId: string | undefined;
  let categoryId: number | undefined;
  let productId: string | undefined;
  let parentOrderId: string | undefined;
  let shopOrderId: string | undefined;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    outbox = app.get(OutboxService);
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await bcrypt.hash('password123', 4),
        fullName: 'Commerce E2E Admin',
        role: UserRole.ADMIN,
      },
    });
    userIds.push(admin.id);
  });

  afterAll(async () => {
    if (prisma) {
      const aggregateIds = [shopId, parentOrderId, shopOrderId].filter((id): id is string => Boolean(id));
      await prisma.notification.deleteMany({ where: { outboxEvent: { aggregateId: { in: aggregateIds } } } });
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: aggregateIds } } });
      await prisma.adminAuditLog.deleteMany({ where: { actorId: { in: userIds } } });
      if (parentOrderId) await prisma.parentOrder.deleteMany({ where: { id: parentOrderId } });
      if (productId) await prisma.cartItem.deleteMany({ where: { productId } });
      if (productId) await prisma.product.deleteMany({ where: { id: productId } });
      if (shopId) await prisma.shop.deleteMany({ where: { id: shopId } });
      if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    if (app) await app.close();
  });

  it('runs onboarding, catalog, checkout, fulfillment, review, and hardened responses', async () => {
    const health = await request(app.getHttpServer())
      .get('/api/health')
      .set('x-request-id', 'commerce-e2e-request')
      .expect(200);
    expect(health.headers['x-request-id']).toBe('commerce-e2e-request');
    expect(health.headers['x-content-type-options']).toBe('nosniff');

    const vendorRegistration = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: vendorEmail, password: 'password123', fullName: 'Commerce Vendor Candidate' })
      .expect(201);
    userIds.push(vendorRegistration.body.user.id);

    const shop = await request(app.getHttpServer())
      .post('/api/shops')
      .set('Authorization', `Bearer ${vendorRegistration.body.accessToken}`)
      .send({ name: 'Commerce E2E Shop', slug: `commerce-e2e-shop-${suffix}` })
      .expect(201);
    shopId = shop.body.id;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'password123' })
      .expect(200);
    const adminToken = adminLogin.body.accessToken as string;
    await request(app.getHttpServer())
      .patch(`/api/shops/${shopId}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' })
      .expect(200);

    const category = await request(app.getHttpServer())
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Commerce E2E Category', slug: `commerce-e2e-category-${suffix}` })
      .expect(201);
    categoryId = category.body.id;

    const vendorLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: vendorEmail, password: 'password123' })
      .expect(200);
    expect(vendorLogin.body.user.role).toBe(UserRole.VENDOR);
    const vendorToken = vendorLogin.body.accessToken as string;
    await outbox.runOnce();
    const shopReviewNotifications = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${vendorToken}`)
      .expect(200);
    expect(shopReviewNotifications.body.data.some((notification: { type: string }) => notification.type === 'SHOP_REVIEWED')).toBe(true);

    const product = await request(app.getHttpServer())
      .post(`/api/shops/${shopId}/products`)
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({
        name: 'Commerce E2E Product',
        slug: `commerce-e2e-product-${suffix}`,
        categoryId,
        price: 250000,
        initialStock: 3,
        status: ProductStatus.DRAFT,
      })
      .expect(201);
    productId = product.body.id;
    await request(app.getHttpServer())
      .patch(`/api/products/${productId}/status`)
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({ status: ProductStatus.ACTIVE })
      .expect(200);

    const customerRegistration = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: customerEmail, password: 'password123', fullName: 'Commerce Customer' })
      .expect(201);
    userIds.push(customerRegistration.body.user.id);
    const customerToken = customerRegistration.body.accessToken as string;
    const address = await request(app.getHttpServer())
      .post('/api/users/me/addresses')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        recipient: 'Commerce Customer',
        phone: '0900000000',
        line1: '1 Commerce Street',
        ward: 'Commerce Ward',
        district: 'Commerce District',
        city: 'Ho Chi Minh City',
      })
      .expect(201);

    const listing = await request(app.getHttpServer()).get('/api/products').expect(200);
    expect(listing.body.items.some((item: { id: string }) => item.id === productId)).toBe(true);
    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId, quantity: 2 })
      .expect(201);

    const quote = await request(app.getHttpServer())
      .post('/api/checkout/quote')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({})
      .expect(201);
    expect(quote.body.subtotal).toBe('500000');
    expect(quote.body.total).toBe('530000');

    const checkout = await request(app.getHttpServer())
      .post('/api/checkout/commit')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        idempotencyKey: randomUUID(),
        addressId: address.body.id,
        paymentMethod: 'COD',
      })
      .expect(201);
    parentOrderId = checkout.body.id;
    shopOrderId = checkout.body.shopOrders[0].id as string;
    const orderItemId = checkout.body.shopOrders[0].items[0].id as string;

    await outbox.runOnce();
    const customerNotifications = await request(app.getHttpServer())
      .get('/api/notifications?unreadOnly=true')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(customerNotifications.body.data.some((notification: { type: string }) => notification.type === 'ORDER_PLACED')).toBe(true);
    const vendorNotifications = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${vendorToken}`)
      .expect(200);
    expect(vendorNotifications.body.data.some((notification: { type: string }) => notification.type === 'NEW_SHOP_ORDER')).toBe(true);

    const prematureReview = await request(app.getHttpServer())
      .post('/api/reviews')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ orderItemId, rating: 5 })
      .expect(400);
    expect(prematureReview.body).toEqual(expect.objectContaining({
      code: 'BAD_REQUEST',
      requestId: expect.any(String),
      path: '/api/reviews',
    }));

    for (const status of [
      ShopOrderStatus.CONFIRMED,
      ShopOrderStatus.PACKING,
      ShopOrderStatus.READY_TO_HANDOFF,
      ShopOrderStatus.DELIVERED,
    ]) {
      await request(app.getHttpServer())
        .patch(`/api/shop-orders/${shopOrderId}/status`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ status })
        .expect(200);
    }

    const completedOrder = await request(app.getHttpServer())
      .get(`/api/orders/${parentOrderId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(completedOrder.body.status).toBe('COMPLETED');

    await outbox.runOnce();
    const completedNotifications = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(completedNotifications.body.data.some((notification: { type: string; data?: { status?: string } }) => (
      notification.type === 'SHOP_ORDER_STATUS_CHANGED' && notification.data?.status === ShopOrderStatus.DELIVERED
    ))).toBe(true);
    await request(app.getHttpServer())
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    const unread = await request(app.getHttpServer())
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(unread.body.count).toBe(0);

    const review = await request(app.getHttpServer())
      .post('/api/reviews')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ orderItemId, rating: 5, comment: 'Complete e2e flow works' })
      .expect(201);
    expect(review.body.productId).toBe(productId);

    const publicReviews = await request(app.getHttpServer())
      .get(`/api/products/${productId}/reviews`)
      .expect(200);
    expect(publicReviews.body.total).toBe(1);
    expect(publicReviews.body.averageRating).toBe(5);

    const notFound = await request(app.getHttpServer()).get('/api/not-a-route').expect(404);
    expect(notFound.body).toEqual(expect.objectContaining({
      statusCode: 404,
      code: 'NOT_FOUND',
      requestId: expect.any(String),
    }));
  });
});
