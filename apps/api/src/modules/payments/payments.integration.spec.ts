import 'dotenv/config';
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentMethod,
  PaymentStatus,
  PaymentWebhookType,
  RefundStatus,
  UserRole,
} from '@prisma/client';
import { createHmac } from 'crypto';
import { describe, expect, it } from '@jest/globals';
import { PrismaService } from '../../prisma/prisma.service';
import { BankTransferWebhookDto } from './dto/payments.dto';
import { PaymentsService } from './payments.service';
import { SepayGatewayService } from './sepay-gateway.service';

describe('Payment webhook and refund integration', () => {
  it('settles a SePay payment once from an authenticated, captured ORDER_PAID IPN', async () => {
    const prisma = new PrismaService();
    const ipnSecret = 'sepay-ipn-integration-secret';
    const config = new ConfigService({
      SEPAY_ENV: 'sandbox',
      SEPAY_MERCHANT_ID: 'integration-merchant',
      SEPAY_SECRET_KEY: 'integration-secret',
      SEPAY_IPN_SECRET: ipnSecret,
      SEPAY_RETURN_URL: 'http://localhost:3000/payments/sepay/return',
    });
    const sepay = new SepayGatewayService(config);
    const service = new PaymentsService(prisma, config, undefined, sepay);
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const customer = await prisma.user.create({
      data: { email: `sepay-customer-${suffix}@example.com`, passwordHash: 'test', fullName: 'SePay Customer' },
    });
    const order = await prisma.parentOrder.create({
      data: {
        userId: customer.id,
        orderNumber: `SEPAY-${suffix}`,
        subtotalAmount: 125000,
        totalAmount: 125000,
        shippingAddress: { recipient: 'SePay Customer' },
        payments: { create: { method: PaymentMethod.SEPAY, provider: 'sepay', amount: 125000 } },
      },
      include: { payments: true },
    });
    const payment = order.payments[0];
    const payload = {
      timestamp: Math.floor(Date.now() / 1000),
      notification_type: 'ORDER_PAID',
      order: {
        id: `sepay-order-${suffix}`,
        order_status: 'CAPTURED',
        order_currency: 'VND',
        order_amount: '125000.00',
        order_invoice_number: payment.id,
      },
      transaction: {
        id: `sepay-transaction-${suffix}`,
        transaction_id: `bank-reference-${suffix}`,
        transaction_status: 'APPROVED',
        transaction_amount: '125000',
        transaction_currency: 'VND',
      },
      customer: { id: customer.id, customer_id: customer.id },
    };
    const rawBody = Buffer.from(JSON.stringify(payload));

    try {
      await expect(service.processSepayIpn('wrong', rawBody, payload)).rejects.toBeInstanceOf(UnauthorizedException);
      const accepted = await service.processSepayIpn(ipnSecret, rawBody, payload);
      expect(accepted).toEqual(expect.objectContaining({ duplicate: false, paymentStatus: PaymentStatus.PAID }));
      const replay = await service.processSepayIpn(ipnSecret, rawBody, payload);
      expect(replay.duplicate).toBe(true);
      expect((await prisma.parentOrder.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus)
        .toBe(PaymentStatus.PAID);
      expect(await prisma.paymentWebhookEvent.count({ where: { paymentId: payment.id, provider: 'sepay' } }))
        .toBe(1);

      const secondOrder = await prisma.parentOrder.create({
        data: {
          userId: customer.id,
          orderNumber: `SEPAY-MISMATCH-${suffix}`,
          subtotalAmount: 125000,
          totalAmount: 125000,
          shippingAddress: { recipient: 'SePay Customer' },
          payments: { create: { method: PaymentMethod.SEPAY, provider: 'sepay', amount: 125000 } },
        },
        include: { payments: true },
      });
      const mismatched = {
        ...payload,
        order: { ...payload.order, order_invoice_number: secondOrder.payments[0].id },
        transaction: { ...payload.transaction, id: `sepay-mismatch-${suffix}`, transaction_amount: '1' },
      };
      await expect(service.processSepayIpn(ipnSecret, Buffer.from(JSON.stringify(mismatched)), mismatched))
        .rejects.toBeInstanceOf(BadRequestException);
      await prisma.parentOrder.delete({ where: { id: secondOrder.id } });
    } finally {
      await prisma.parentOrder.deleteMany({ where: { userId: customer.id } });
      await prisma.user.delete({ where: { id: customer.id } });
      await prisma.$disconnect();
    }
  });

  it('verifies signatures, deduplicates events, and protects partial/full refunds under concurrency', async () => {
    const prisma = new PrismaService();
    const secret = 'phase5-integration-secret-at-least-32-characters';
    const service = new PaymentsService(prisma, new ConfigService({
      BANK_TRANSFER_PROVIDER: 'phase5-bank',
      BANK_TRANSFER_WEBHOOK_SECRET: secret,
      PAYMENT_WEBHOOK_TOLERANCE_SECONDS: 300,
    }));
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const userIds: string[] = [];
    let parentOrderId: string | undefined;

    await prisma.$connect();
    try {
      const [customer, admin] = await Promise.all([
        prisma.user.create({
          data: {
            email: `phase5-customer-${suffix}@example.com`,
            passwordHash: 'not-used',
            fullName: 'Phase 5 Customer',
          },
        }),
        prisma.user.create({
          data: {
            email: `phase5-admin-${suffix}@example.com`,
            passwordHash: 'not-used',
            fullName: 'Phase 5 Admin',
            role: UserRole.ADMIN,
          },
        }),
      ]);
      userIds.push(customer.id, admin.id);
      const order = await prisma.parentOrder.create({
        data: {
          userId: customer.id,
          orderNumber: `PHASE5-${suffix}`,
          subtotalAmount: 1000,
          totalAmount: 1000,
          shippingAddress: { recipient: 'Phase 5 Customer' },
          payments: {
            create: {
              method: PaymentMethod.BANK_TRANSFER,
              amount: 1000,
            },
          },
        },
        include: { payments: true },
      });
      parentOrderId = order.id;
      const payment = order.payments[0];

      const paidEvent: BankTransferWebhookDto = {
        eventId: `payment-paid-${suffix}`,
        type: PaymentWebhookType.PAYMENT_SUCCEEDED,
        paymentId: payment.id,
        providerReference: `provider-payment-${suffix}`,
        amount: '1000.00',
      };
      await expect(sendWebhook(service, secret, paidEvent, 'bad-signature')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      const paidResult = await sendWebhook(service, secret, paidEvent);
      expect(paidResult).toEqual(expect.objectContaining({
        duplicate: false,
        paymentStatus: PaymentStatus.PAID,
      }));
      const replay = await sendWebhook(service, secret, paidEvent);
      expect(replay.duplicate).toBe(true);
      expect(await prisma.paymentWebhookEvent.count({ where: { paymentId: payment.id } })).toBe(1);
      const paidPayment = await prisma.payment.findUniqueOrThrow({
        where: { id: payment.id },
        include: { statusHistory: { orderBy: { createdAt: 'asc' } } },
      });
      expect(paidPayment.statusHistory.map((item) => item.toStatus)).toEqual([
        PaymentStatus.AUTHORIZED,
        PaymentStatus.PAID,
      ]);

      const firstRefund = await service.createRefund(admin.id, payment.id, {
        amount: '400.00',
        idempotencyKey: `refund-first-${suffix}`,
        reason: 'Partial customer refund',
      });
      const firstRefundReplay = await service.createRefund(admin.id, payment.id, {
        amount: '400.00',
        idempotencyKey: `refund-first-${suffix}`,
        reason: 'Partial customer refund',
      });
      expect(firstRefundReplay.id).toBe(firstRefund.id);
      await expect(service.createRefund(admin.id, payment.id, {
        amount: '401.00',
        idempotencyKey: `refund-first-${suffix}`,
        reason: 'Partial customer refund',
      })).rejects.toBeInstanceOf(ConflictException);

      const firstRefundEvent: BankTransferWebhookDto = {
        eventId: `refund-first-success-${suffix}`,
        type: PaymentWebhookType.REFUND_SUCCEEDED,
        paymentId: payment.id,
        refundId: firstRefund.id,
        providerReference: `provider-refund-first-${suffix}`,
        amount: '400.00',
      };
      const partialResult = await sendWebhook(service, secret, firstRefundEvent);
      expect(partialResult).toEqual(expect.objectContaining({
        paymentStatus: PaymentStatus.PARTIALLY_REFUNDED,
        refundStatus: RefundStatus.SUCCEEDED,
      }));
      await expect(service.createRefund(admin.id, payment.id, {
        amount: '600.01',
        idempotencyKey: `refund-too-large-${suffix}`,
      })).rejects.toBeInstanceOf(BadRequestException);

      const failedRefund = await service.createRefund(admin.id, payment.id, {
        amount: '100.00',
        idempotencyKey: `refund-failed-${suffix}`,
      });
      const failedResult = await sendWebhook(service, secret, {
        eventId: `refund-failed-event-${suffix}`,
        type: PaymentWebhookType.REFUND_FAILED,
        paymentId: payment.id,
        refundId: failedRefund.id,
        providerReference: `provider-refund-failed-${suffix}`,
        amount: '100.00',
        failureReason: 'Provider rejected destination account',
      });
      expect(failedResult).toEqual(expect.objectContaining({
        paymentStatus: PaymentStatus.PARTIALLY_REFUNDED,
        refundStatus: RefundStatus.FAILED,
      }));

      const concurrent = await Promise.allSettled([
        service.createRefund(admin.id, payment.id, {
          amount: '600.00',
          idempotencyKey: `refund-final-a-${suffix}`,
        }),
        service.createRefund(admin.id, payment.id, {
          amount: '600.00',
          idempotencyKey: `refund-final-b-${suffix}`,
        }),
      ]);
      expect(concurrent.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(concurrent.filter((result) => result.status === 'rejected')).toHaveLength(1);
      const finalRefund = concurrent.find((result) => result.status === 'fulfilled')!;
      if (finalRefund.status !== 'fulfilled') throw new Error('Expected one final refund request');

      const finalRefundEvent: BankTransferWebhookDto = {
        eventId: `refund-final-success-${suffix}`,
        type: PaymentWebhookType.REFUND_SUCCEEDED,
        paymentId: payment.id,
        refundId: finalRefund.value.id,
        providerReference: `provider-refund-final-${suffix}`,
        amount: '600.00',
      };
      const fullResult = await sendWebhook(service, secret, finalRefundEvent);
      expect(fullResult.paymentStatus).toBe(PaymentStatus.REFUNDED);

      const finalPayment = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      const finalOrder = await prisma.parentOrder.findUniqueOrThrow({ where: { id: order.id } });
      const refunds = await service.listRefunds(payment.id);
      expect(finalPayment.status).toBe(PaymentStatus.REFUNDED);
      expect(finalOrder.paymentStatus).toBe(PaymentStatus.REFUNDED);
      expect(refunds.filter((refund) => refund.status === RefundStatus.SUCCEEDED)).toHaveLength(2);
      expect(refunds.filter((refund) => refund.status === RefundStatus.FAILED)).toHaveLength(1);
      expect(refunds
        .filter((refund) => refund.status === RefundStatus.SUCCEEDED)
        .reduce((sum, refund) => sum + Number(refund.amount), 0)).toBe(1000);

      const tampered = { ...paidEvent, providerReference: `tampered-${suffix}` };
      await expect(sendWebhook(service, secret, tampered)).rejects.toBeInstanceOf(ConflictException);
    } finally {
      if (parentOrderId) await prisma.parentOrder.delete({ where: { id: parentOrderId } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.$disconnect();
    }
  });

  it('requires explicit offline confirmation and records partial/full COD refunds atomically', async () => {
    const prisma = new PrismaService();
    const service = new PaymentsService(prisma);
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const [customer, admin] = await Promise.all([
      prisma.user.create({
        data: { email: `cod-refund-customer-${suffix}@example.com`, passwordHash: 'test', fullName: 'COD Customer' },
      }),
      prisma.user.create({
        data: { email: `cod-refund-admin-${suffix}@example.com`, passwordHash: 'test', fullName: 'COD Admin', role: UserRole.ADMIN },
      }),
    ]);
    const order = await prisma.parentOrder.create({
      data: {
        userId: customer.id,
        orderNumber: `COD-REFUND-${suffix}`,
        subtotalAmount: 1000,
        totalAmount: 1000,
        paymentStatus: PaymentStatus.PAID,
        shippingAddress: { recipient: 'COD Customer' },
        payments: { create: { method: PaymentMethod.COD, amount: 1000, status: PaymentStatus.PAID, paidAt: new Date() } },
      },
      include: { payments: true },
    });
    const payment = order.payments[0];

    try {
      await expect(service.createRefund(admin.id, payment.id, {
        amount: '400.00', idempotencyKey: `cod-partial-${suffix}`,
      })).rejects.toThrow('explicit confirmation');
      const partial = await service.createRefund(admin.id, payment.id, {
        amount: '400.00',
        idempotencyKey: `cod-partial-${suffix}`,
        reason: 'Cash returned at service desk',
        confirmOfflineRefund: true,
      });
      expect(partial.status).toBe(RefundStatus.SUCCEEDED);
      expect(partial.provider).toBeNull();
      expect(partial.refundedAt).toBeInstanceOf(Date);
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status)
        .toBe(PaymentStatus.PARTIALLY_REFUNDED);
      await expect(service.createRefund(admin.id, payment.id, {
        amount: '400.00',
        idempotencyKey: `cod-partial-${suffix}`,
        reason: 'Cash returned at service desk',
      })).rejects.toThrow('explicit confirmation');
      const partialRetry = await service.createRefund(admin.id, payment.id, {
        amount: '400.00',
        idempotencyKey: `cod-partial-${suffix}`,
        reason: 'Cash returned at service desk',
        confirmOfflineRefund: true,
      });
      expect(partialRetry.id).toBe(partial.id);

      const completed = await service.createRefund(admin.id, payment.id, {
        amount: '600.00',
        idempotencyKey: `cod-final-${suffix}`,
        confirmOfflineRefund: true,
      });
      expect(completed.status).toBe(RefundStatus.SUCCEEDED);
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status)
        .toBe(PaymentStatus.REFUNDED);
      expect((await prisma.parentOrder.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus)
        .toBe(PaymentStatus.REFUNDED);
    } finally {
      await prisma.parentOrder.delete({ where: { id: order.id } });
      await prisma.user.deleteMany({ where: { id: { in: [customer.id, admin.id] } } });
      await prisma.$disconnect();
    }
  });
});

async function sendWebhook(
  service: PaymentsService,
  secret: string,
  payload: BankTransferWebhookDto,
  signatureOverride?: string,
) {
  const rawBody = Buffer.from(JSON.stringify(payload));
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signatureOverride ?? `sha256=${createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest('hex')}`;
  return service.processBankTransferWebhook(signature, timestamp, rawBody, payload);
}
