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
  const userIds: string[] = [];
  let parentOrderId: string | undefined;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService({
        BANK_TRANSFER_PROVIDER: 'phase5-http-bank',
        BANK_TRANSFER_WEBHOOK_SECRET: secret,
        PAYMENT_WEBHOOK_TOLERANCE_SECONDS: 300,
        RATE_LIMIT_MAX: 1000,
      }))
      .compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (parentOrderId) await prisma.parentOrder.delete({ where: { id: parentOrderId } });
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
    parentOrderId = order.id;
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
});

function sign(secret: string, timestamp: string, rawBody: string) {
  return `sha256=${createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest('hex')}`;
}
