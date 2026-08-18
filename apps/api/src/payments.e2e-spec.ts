import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PaymentMethod, PaymentStatus, PaymentWebhookType } from '@prisma/client';
import { createHmac } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import * as request from 'supertest';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { PrismaService } from './prisma/prisma.service';

describe('Payment webhook HTTP security (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const secret = 'phase5-e2e-secret-at-least-32-characters';
  const sepayIpnSecret = 'sepay-e2e-ipn-secret';
  const userIds: string[] = [];
  const parentOrderIds: string[] = [];
  const paymentIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService({
        BANK_TRANSFER_PROVIDER: 'phase5-http-bank',
        BANK_TRANSFER_WEBHOOK_SECRET: secret,
        PAYMENT_WEBHOOK_TOLERANCE_SECONDS: 300,
        SEPAY_ENV: 'sandbox',
        SEPAY_MERCHANT_ID: 'sepay-e2e-merchant',
        SEPAY_SECRET_KEY: 'sepay-e2e-secret',
        SEPAY_IPN_SECRET: sepayIpnSecret,
        SEPAY_RETURN_URL: 'http://localhost:3000/payments/sepay/return',
        RATE_LIMIT_MAX: 1000,
      }))
      .compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (paymentIds.length) {
      await prisma.notification.deleteMany({ where: { outboxEvent: { aggregateId: { in: paymentIds } } } });
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: paymentIds } } });
    }
    if (parentOrderIds.length) await prisma.parentOrder.deleteMany({ where: { id: { in: parentOrderIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('rejects unsigned/stale payloads and accepts an exact signed raw body once', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const customer = await prisma.user.create({
      data: {
        email: `phase5-http-customer-${suffix}@example.com`,
        passwordHash: 'not-used',
        fullName: 'Phase 5 HTTP Customer',
      },
    });
    userIds.push(customer.id);
    const order = await prisma.parentOrder.create({
      data: {
        userId: customer.id,
        orderNumber: `PHASE5-HTTP-${suffix}`,
        subtotalAmount: 250000,
        totalAmount: 250000,
        shippingAddress: { recipient: 'Phase 5 HTTP Customer' },
        payments: { create: { method: PaymentMethod.BANK_TRANSFER, amount: 250000 } },
      },
      include: { payments: true },
    });
    parentOrderIds.push(order.id);
    paymentIds.push(order.payments[0].id);
    const payload = {
      eventId: `phase5-http-event-${suffix}`,
      type: PaymentWebhookType.PAYMENT_SUCCEEDED,
      paymentId: order.payments[0].id,
      providerReference: `phase5-http-provider-${suffix}`,
      amount: '250000.00',
    };
    const rawBody = JSON.stringify(payload);

    const unsigned = await request(app.getHttpServer())
      .post('/api/payments/webhooks/bank-transfer')
      .set('content-type', 'application/json')
      .send(rawBody)
      .expect(401);
    expect(unsigned.body).toEqual(expect.objectContaining({
      code: 'UNAUTHORIZED',
      requestId: expect.any(String),
    }));

    const staleTimestamp = `${Math.floor(Date.now() / 1000) - 3600}`;
    await request(app.getHttpServer())
      .post('/api/payments/webhooks/bank-transfer')
      .set('content-type', 'application/json')
      .set('x-webhook-timestamp', staleTimestamp)
      .set('x-webhook-signature', sign(secret, staleTimestamp, rawBody))
      .send(rawBody)
      .expect(401);

    const timestamp = `${Math.floor(Date.now() / 1000)}`;
    const accepted = await request(app.getHttpServer())
      .post('/api/payments/webhooks/bank-transfer')
      .set('content-type', 'application/json')
      .set('x-request-id', `phase5-http-${suffix}`)
      .set('x-webhook-timestamp', timestamp)
      .set('x-webhook-signature', sign(secret, timestamp, rawBody))
      .send(rawBody)
      .expect(200);
    expect(accepted.headers['x-request-id']).toBe(`phase5-http-${suffix}`);
    expect(accepted.body).toEqual(expect.objectContaining({
      duplicate: false,
      paymentStatus: PaymentStatus.PAID,
    }));

    const replay = await request(app.getHttpServer())
      .post('/api/payments/webhooks/bank-transfer')
      .set('content-type', 'application/json')
      .set('x-webhook-timestamp', timestamp)
      .set('x-webhook-signature', sign(secret, timestamp, rawBody))
      .send(rawBody)
      .expect(200);
    expect(replay.body.duplicate).toBe(true);
    expect(await prisma.paymentWebhookEvent.count({ where: { paymentId: order.payments[0].id } })).toBe(1);
  });

  it('accepts the official SePay IPN shape only with the configured secret', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const customer = await prisma.user.create({
      data: {
        email: `sepay-http-customer-${suffix}@example.com`,
        passwordHash: 'not-used',
        fullName: 'SePay HTTP Customer',
      },
    });
    userIds.push(customer.id);
    const order = await prisma.parentOrder.create({
      data: {
        userId: customer.id,
        orderNumber: `SEPAY-HTTP-${suffix}`,
        subtotalAmount: 350000,
        totalAmount: 350000,
        shippingAddress: { recipient: 'SePay HTTP Customer' },
        payments: { create: { method: PaymentMethod.SEPAY, provider: 'sepay', amount: 350000 } },
      },
      include: { payments: true },
    });
    parentOrderIds.push(order.id);
    paymentIds.push(order.payments[0].id);
    const payload = {
      timestamp: Math.floor(Date.now() / 1000),
      notification_type: 'ORDER_PAID',
      order: {
        id: `order-${suffix}`,
        order_id: `SEPAY-${suffix}`,
        order_status: 'CAPTURED',
        order_currency: 'VND',
        order_amount: '350000.00',
        order_invoice_number: order.payments[0].id,
        custom_data: [],
        user_agent: 'SePay E2E',
        ip_address: '127.0.0.1',
        order_description: 'E2E payment',
      },
      transaction: {
        id: `transaction-${suffix}`,
        payment_method: 'BANK_TRANSFER',
        transaction_id: `bank-${suffix}`,
        transaction_type: 'PAYMENT',
        transaction_date: '2026-08-18 12:00:00',
        transaction_status: 'APPROVED',
        transaction_amount: '350000',
        transaction_currency: 'VND',
      },
      customer: { id: customer.id, customer_id: customer.id },
    };

    await request(app.getHttpServer())
      .post('/api/payments/webhooks/sepay')
      .set('content-type', 'application/json')
      .send(payload)
      .expect(401);

    const accepted = await request(app.getHttpServer())
      .post('/api/payments/webhooks/sepay')
      .set('content-type', 'application/json')
      .set('x-secret-key', sepayIpnSecret)
      .send(payload)
      .expect(200);
    expect(accepted.body).toEqual(expect.objectContaining({
      duplicate: false,
      paymentStatus: PaymentStatus.PAID,
    }));
  });
});

function sign(secret: string, timestamp: string, rawBody: string) {
  return `sha256=${createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest('hex')}`;
}
