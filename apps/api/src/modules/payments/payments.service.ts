import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentMethod,
  NotificationType,
  PaymentStatus,
  PaymentWebhookType,
  Prisma,
  RefundStatus,
} from '@prisma/client';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboxService } from '../notifications/outbox.service';
import {
  BankTransferWebhookDto,
  CreateRefundDto,
  PaymentQueryDto,
  SepayIpnDto,
  UpdatePaymentStatusDto,
} from './dto/payments.dto';
import { SepayGatewayService } from './sepay-gateway.service';

const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  UNPAID: [PaymentStatus.AUTHORIZED, PaymentStatus.FAILED],
  AUTHORIZED: [PaymentStatus.PAID, PaymentStatus.FAILED],
  PAID: [],
  FAILED: [],
  REFUND_PENDING: [],
  PARTIALLY_REFUNDED: [],
  REFUNDED: [],
};

const REFUND_WEBHOOK_TYPES = new Set<PaymentWebhookType>([
  PaymentWebhookType.REFUND_SUCCEEDED,
  PaymentWebhookType.REFUND_FAILED,
]);

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService = new ConfigService(),
    private readonly outbox?: OutboxService,
    private readonly sepay?: SepayGatewayService,
  ) {}

  async createSepayCheckout(userId: string, paymentId: string) {
    const payment = await this.findOwnedSepayPayment(userId, paymentId);
    if (payment.status !== PaymentStatus.UNPAID && payment.status !== PaymentStatus.AUTHORIZED) {
      throw new BadRequestException(`Payment in ${payment.status} cannot start SePay checkout`);
    }
    const sepay = this.requireSepay();
    return sepay.createPayment({
      paymentId: payment.id,
      parentOrderId: payment.parentOrder.id,
      orderNumber: payment.parentOrder.orderNumber,
      amount: payment.amount.toFixed(2),
      customerId: userId,
    });
  }

  async reconcileSepayPayment(userId: string, paymentId: string) {
    const payment = await this.findOwnedSepayPayment(userId, paymentId);
    if (payment.status === PaymentStatus.PAID) {
      return { paymentId: payment.id, paymentStatus: payment.status, alreadySettled: true };
    }
    if (payment.status !== PaymentStatus.UNPAID && payment.status !== PaymentStatus.AUTHORIZED) {
      throw new BadRequestException(`Payment in ${payment.status} cannot be reconciled`);
    }

    const payload = await this.requireSepay().retrieveOrder(payment.id);
    const normalized = this.normalizeSepayOrder(payload, payment.id);
    if (normalized.orderStatus !== 'CAPTURED' || normalized.transactionStatus !== 'APPROVED') {
      throw new BadRequestException(
        `SePay has not captured this payment yet (${normalized.orderStatus || 'UNKNOWN'})`,
      );
    }
    if (normalized.currency !== 'VND') throw new BadRequestException('SePay currency must be VND');
    const rawBody = Buffer.from(JSON.stringify(payload));
    return this.processProviderWebhook(rawBody, {
      eventId: `RECONCILE:${normalized.providerReference}`,
      type: PaymentWebhookType.PAYMENT_SUCCEEDED,
      paymentId: payment.id,
      providerReference: normalized.providerReference,
      amount: normalized.amount,
    }, 'sepay', PaymentMethod.SEPAY);
  }

  async listForAdmin(query: PaymentQueryDto) {
    const where: Prisma.PaymentWhereInput = { status: query.status, method: query.method };
    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          parentOrder: {
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
              user: { select: { id: true, email: true, fullName: true } },
            },
          },
          refunds: { include: { statusHistory: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } },
          statusHistory: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { data, total, page: query.page, limit: query.limit };
  }

  async updateStatus(actorId: string, paymentId: string, dto: UpdatePaymentStatusDto) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { parentOrder: { select: { id: true, userId: true, orderNumber: true } } },
      });
      if (!payment) throw new NotFoundException('Payment not found');
      if (!PAYMENT_TRANSITIONS[payment.status].includes(dto.status)) {
        throw new BadRequestException(`Invalid payment transition: ${payment.status} -> ${dto.status}`);
      }

      const updated = await tx.payment.updateMany({
        where: { id: payment.id, status: payment.status },
        data: { status: dto.status, paidAt: dto.status === PaymentStatus.PAID ? new Date() : payment.paidAt },
      });
      if (updated.count !== 1) throw new ConflictException('Payment changed concurrently');
      await tx.paymentStatusHistory.create({
        data: {
          paymentId: payment.id,
          fromStatus: payment.status,
          toStatus: dto.status,
          actorId,
          note: dto.note?.trim() || null,
        },
      });
      await tx.parentOrder.update({
        where: { id: payment.parentOrderId },
        data: { paymentStatus: dto.status },
      });
      if (this.outbox) {
        await this.outbox.enqueue(tx, {
          userId: payment.parentOrder.userId,
          type: NotificationType.PAYMENT_STATUS_CHANGED,
          title: 'Payment status updated',
          message: `Payment for order ${payment.parentOrder.orderNumber} is now ${dto.status}.`,
          data: { parentOrderId: payment.parentOrder.id, paymentId: payment.id, status: dto.status },
          aggregateType: 'Payment',
          aggregateId: payment.id,
        });
      }
      return tx.payment.findUniqueOrThrow({
        where: { id: payment.id },
        include: { statusHistory: { orderBy: { createdAt: 'asc' } } },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async createRefund(actorId: string, paymentId: string, dto: CreateRefundDto) {
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) throw new BadRequestException('Refund amount must be greater than zero');
    const idempotencyKey = dto.idempotencyKey.trim();
    const reason = dto.reason?.trim() || null;

    try {
      return await this.withSerializableRetry(async (tx) => {
        const payment = await tx.payment.findUnique({
          where: { id: paymentId },
          include: { parentOrder: { select: { id: true, userId: true, orderNumber: true } } },
        });
        if (!payment) throw new NotFoundException('Payment not found');
        const offlineRefund = this.assertRefundChannelConfirmation(payment.method, dto.confirmOfflineRefund);

        const existing = await tx.refund.findUnique({
          where: { paymentId_idempotencyKey: { paymentId, idempotencyKey } },
          include: { statusHistory: { orderBy: { createdAt: 'asc' } } },
        });
        if (existing) {
          this.assertMatchingRefundRequest(existing, amount, reason);
          return existing;
        }
        if (payment.status !== PaymentStatus.PAID && payment.status !== PaymentStatus.PARTIALLY_REFUNDED) {
          throw new BadRequestException(`Payment in ${payment.status} cannot be refunded`);
        }

        const successful = await tx.refund.aggregate({
          where: { paymentId, status: RefundStatus.SUCCEEDED },
          _sum: { amount: true },
        });
        const refundedAmount = successful._sum.amount ?? new Prisma.Decimal(0);
        const remainingAmount = payment.amount.minus(refundedAmount);
        if (amount.gt(remainingAmount)) {
          throw new BadRequestException(`Refund amount exceeds remaining refundable amount ${remainingAmount.toFixed(2)}`);
        }

        const nextPaymentStatus = offlineRefund
          ? refundedAmount.add(amount).equals(payment.amount)
            ? PaymentStatus.REFUNDED
            : PaymentStatus.PARTIALLY_REFUNDED
          : PaymentStatus.REFUND_PENDING;
        const nextRefundStatus = offlineRefund ? RefundStatus.SUCCEEDED : RefundStatus.PENDING;
        const claimed = await tx.payment.updateMany({
          where: { id: payment.id, status: payment.status },
          data: { status: nextPaymentStatus },
        });
        if (claimed.count !== 1) throw new ConflictException('Payment changed concurrently; retry refund request');

        const refund = await tx.refund.create({
          data: {
            paymentId,
            requestedById: actorId,
            idempotencyKey,
            amount,
            reason,
            provider: offlineRefund ? null : this.webhookProvider(),
            status: nextRefundStatus,
            refundedAt: offlineRefund ? new Date() : null,
            statusHistory: {
              create: {
                fromStatus: null,
                toStatus: nextRefundStatus,
                actorId,
                note: offlineRefund ? reason || 'COD cash return confirmed offline' : reason,
              },
            },
          },
          include: { statusHistory: { orderBy: { createdAt: 'asc' } } },
        });
        await tx.paymentStatusHistory.create({
          data: {
            paymentId,
            fromStatus: payment.status,
            toStatus: nextPaymentStatus,
            actorId,
            note: offlineRefund ? `COD refund completed offline: ${refund.id}` : `Refund requested: ${refund.id}`,
          },
        });
        await tx.parentOrder.update({
          where: { id: payment.parentOrderId },
          data: { paymentStatus: nextPaymentStatus },
        });
        if (this.outbox) {
          await this.outbox.enqueue(tx, {
            userId: payment.parentOrder.userId,
            type: NotificationType.REFUND_STATUS_CHANGED,
            title: offlineRefund ? 'Refund completed' : 'Refund requested',
            message: `A refund of ${amount.toFixed(2)} for order ${payment.parentOrder.orderNumber} is ${nextRefundStatus}.`,
            data: {
              parentOrderId: payment.parentOrder.id,
              paymentId: payment.id,
              refundId: refund.id,
              status: nextRefundStatus,
            },
            aggregateType: 'Refund',
            aggregateId: refund.id,
          });
        }
        return refund;
      }, 'Refund changed concurrently; please retry');
    } catch (error) {
      if (!this.isPrismaError(error, 'P2002')) throw error;
      const existing = await this.prisma.refund.findUnique({
        where: { paymentId_idempotencyKey: { paymentId, idempotencyKey } },
        include: { statusHistory: { orderBy: { createdAt: 'asc' } } },
      });
      if (!existing) throw new ConflictException('Refund idempotency key or provider reference already exists');
      const payment = await this.prisma.payment.findUnique({ where: { id: paymentId }, select: { method: true } });
      if (!payment) throw new NotFoundException('Payment not found');
      this.assertRefundChannelConfirmation(payment.method, dto.confirmOfflineRefund);
      this.assertMatchingRefundRequest(existing, amount, reason);
      return existing;
    }
  }

  async listRefunds(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return this.prisma.refund.findMany({
      where: { paymentId },
      include: { statusHistory: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async processBankTransferWebhook(
    signature: string | undefined,
    timestamp: string | undefined,
    rawBody: Buffer | undefined,
    dto: BankTransferWebhookDto,
  ) {
    this.verifyWebhookSignature(signature, timestamp, rawBody);
    if (!rawBody) throw new UnauthorizedException('Webhook raw body is unavailable');

    return this.processProviderWebhook(
      rawBody,
      dto,
      this.webhookProvider(),
      PaymentMethod.BANK_TRANSFER,
    );
  }

  async processSepayIpn(
    secret: string | undefined,
    rawBody: Buffer | undefined,
    dto: SepayIpnDto,
  ) {
    const sepay = this.requireSepay();
    sepay.verifyIpnSecret(secret);
    if (!rawBody) throw new UnauthorizedException('Webhook raw body is unavailable');
    if (dto.notification_type !== 'ORDER_PAID') {
      throw new BadRequestException('Unsupported SePay notification type');
    }

    const normalized = this.normalizeSepayIpn(dto);
    return this.processProviderWebhook(rawBody, {
      eventId: `ORDER_PAID:${normalized.eventId}`,
      type: PaymentWebhookType.PAYMENT_SUCCEEDED,
      paymentId: normalized.paymentId,
      providerReference: normalized.providerReference,
      amount: normalized.amount,
    }, 'sepay', PaymentMethod.SEPAY);
  }

  private async processProviderWebhook(
    rawBody: Buffer,
    dto: BankTransferWebhookDto,
    provider: string,
    expectedMethod: PaymentMethod,
  ) {

    const isRefundEvent = REFUND_WEBHOOK_TYPES.has(dto.type);
    if (isRefundEvent !== Boolean(dto.refundId)) {
      throw new BadRequestException('refundId is required only for refund webhook events');
    }

    const payloadHash = createHash('sha256').update(rawBody).digest('hex');
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const payment = await tx.payment.findUnique({
            where: { id: dto.paymentId },
            include: { parentOrder: { select: { id: true, userId: true, orderNumber: true } } },
          });
          if (!payment) throw new NotFoundException('Payment not found');
          if (payment.method !== expectedMethod) {
            throw new BadRequestException(`Webhook cannot settle ${payment.method} payments`);
          }

          const refund = dto.refundId
            ? await tx.refund.findUnique({ where: { id: dto.refundId } })
            : null;
          if (dto.refundId && !refund) throw new NotFoundException('Refund not found');
          if (refund && refund.paymentId !== payment.id) {
            throw new BadRequestException('Refund does not belong to payment');
          }

          const event = await tx.paymentWebhookEvent.create({
            data: {
              provider,
              eventId: dto.eventId,
              type: dto.type,
              payloadHash,
              paymentId: payment.id,
              refundId: refund?.id,
            },
          });

          if (refund) {
            await this.applyRefundWebhook(tx, payment, refund, dto, provider);
          } else {
            await this.applyPaymentWebhook(tx, payment, dto, provider);
          }

          const currentPayment = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
          const currentRefund = refund
            ? await tx.refund.findUniqueOrThrow({ where: { id: refund.id } })
            : null;
          if (this.outbox) {
            await this.outbox.enqueue(tx, {
              userId: payment.parentOrder.userId,
              type: refund ? NotificationType.REFUND_STATUS_CHANGED : NotificationType.PAYMENT_STATUS_CHANGED,
              title: refund ? 'Refund status updated' : 'Payment status updated',
              message: refund
                ? `Refund for order ${payment.parentOrder.orderNumber} is now ${currentRefund?.status}.`
                : `Payment for order ${payment.parentOrder.orderNumber} is now ${currentPayment.status}.`,
              data: {
                parentOrderId: payment.parentOrder.id,
                paymentId: payment.id,
                refundId: currentRefund?.id ?? null,
                status: currentRefund?.status ?? currentPayment.status,
              },
              aggregateType: refund ? 'Refund' : 'Payment',
              aggregateId: refund?.id ?? payment.id,
            });
          }
          return {
            duplicate: false,
            eventId: event.eventId,
            paymentId: payment.id,
            paymentStatus: currentPayment.status,
            refundId: currentRefund?.id ?? null,
            refundStatus: currentRefund?.status ?? null,
          };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (this.isPrismaError(error, 'P2002')) {
          const existing = await this.prisma.paymentWebhookEvent.findUnique({
            where: { provider_eventId: { provider, eventId: dto.eventId } },
            include: { payment: true, refund: true },
          });
          if (existing) {
            if (existing.payloadHash !== payloadHash) {
              throw new ConflictException('Webhook event ID was reused with a different payload');
            }
            return {
              duplicate: true,
              eventId: existing.eventId,
              paymentId: existing.paymentId,
              paymentStatus: existing.payment.status,
              refundId: existing.refundId,
              refundStatus: existing.refund?.status ?? null,
            };
          }
          throw new ConflictException('Provider reference was already used');
        }
        if (this.isPrismaError(error, 'P2034') && attempt < 2) continue;
        if (this.isPrismaError(error, 'P2034')) {
          throw new ConflictException('Webhook changed concurrently; provider should retry');
        }
        throw error;
      }
    }
    throw new ConflictException('Webhook changed concurrently; provider should retry');
  }

  private async applyPaymentWebhook(
    tx: Prisma.TransactionClient,
    payment: Prisma.PaymentGetPayload<object>,
    dto: BankTransferWebhookDto,
    provider: string,
  ) {
    const amount = new Prisma.Decimal(dto.amount);
    if (!amount.equals(payment.amount)) throw new BadRequestException('Webhook amount does not match payment amount');

    if (dto.type === PaymentWebhookType.PAYMENT_SUCCEEDED) {
      if (payment.status === PaymentStatus.PAID) {
        if (payment.provider === provider && payment.providerRef === dto.providerReference) return;
        throw new ConflictException('Payment was already settled by another provider transaction');
      }
      if (payment.status !== PaymentStatus.UNPAID && payment.status !== PaymentStatus.AUTHORIZED) {
        throw new BadRequestException(`Payment in ${payment.status} cannot be marked paid`);
      }
      const updated = await tx.payment.updateMany({
        where: { id: payment.id, status: payment.status },
        data: {
          status: PaymentStatus.PAID,
          provider,
          providerRef: dto.providerReference,
          paidAt: new Date(),
        },
      });
      if (updated.count !== 1) throw new ConflictException('Payment changed concurrently');
      if (payment.status === PaymentStatus.UNPAID) {
        await tx.paymentStatusHistory.create({
          data: {
            paymentId: payment.id,
            fromStatus: PaymentStatus.UNPAID,
            toStatus: PaymentStatus.AUTHORIZED,
            note: `Provider authorized webhook event ${dto.eventId}`,
          },
        });
      }
      await tx.paymentStatusHistory.create({
        data: {
          paymentId: payment.id,
          fromStatus: payment.status === PaymentStatus.UNPAID ? PaymentStatus.AUTHORIZED : payment.status,
          toStatus: PaymentStatus.PAID,
          note: `Provider settled webhook event ${dto.eventId}`,
        },
      });
      await this.updateParentPaymentStatus(tx, payment.parentOrderId, PaymentStatus.PAID);
      return;
    }

    if (dto.type !== PaymentWebhookType.PAYMENT_FAILED) {
      throw new BadRequestException('Refund webhook event requires refundId');
    }
    if (payment.status === PaymentStatus.FAILED) {
      if (payment.provider === provider && payment.providerRef === dto.providerReference) return;
      throw new ConflictException('Payment already failed with another provider transaction');
    }
    if (payment.status !== PaymentStatus.UNPAID && payment.status !== PaymentStatus.AUTHORIZED) {
      throw new BadRequestException(`Payment in ${payment.status} cannot be marked failed`);
    }
    const updated = await tx.payment.updateMany({
      where: { id: payment.id, status: payment.status },
      data: { status: PaymentStatus.FAILED, provider, providerRef: dto.providerReference },
    });
    if (updated.count !== 1) throw new ConflictException('Payment changed concurrently');
    await tx.paymentStatusHistory.create({
      data: {
        paymentId: payment.id,
        fromStatus: payment.status,
        toStatus: PaymentStatus.FAILED,
        note: dto.failureReason?.trim() || `Provider failed webhook event ${dto.eventId}`,
      },
    });
    await this.updateParentPaymentStatus(tx, payment.parentOrderId, PaymentStatus.FAILED);
  }

  private async applyRefundWebhook(
    tx: Prisma.TransactionClient,
    payment: Prisma.PaymentGetPayload<object>,
    refund: Prisma.RefundGetPayload<object>,
    dto: BankTransferWebhookDto,
    provider: string,
  ) {
    const amount = new Prisma.Decimal(dto.amount);
    if (!amount.equals(refund.amount)) throw new BadRequestException('Webhook amount does not match refund amount');
    const nextRefundStatus = dto.type === PaymentWebhookType.REFUND_SUCCEEDED
      ? RefundStatus.SUCCEEDED
      : RefundStatus.FAILED;
    if (refund.status !== RefundStatus.PENDING) {
      if (
        refund.status === nextRefundStatus
        && refund.provider === provider
        && refund.providerRef === dto.providerReference
      ) return;
      throw new ConflictException(`Refund is already ${refund.status}`);
    }
    if (payment.status !== PaymentStatus.REFUND_PENDING) {
      throw new ConflictException(`Payment in ${payment.status} has no pending refund`);
    }

    const updatedRefund = await tx.refund.updateMany({
      where: { id: refund.id, status: RefundStatus.PENDING },
      data: {
        status: nextRefundStatus,
        provider,
        providerRef: dto.providerReference,
        failureReason: nextRefundStatus === RefundStatus.FAILED
          ? dto.failureReason?.trim() || 'Provider reported refund failure'
          : null,
        refundedAt: nextRefundStatus === RefundStatus.SUCCEEDED ? new Date() : null,
      },
    });
    if (updatedRefund.count !== 1) throw new ConflictException('Refund changed concurrently');
    await tx.refundStatusHistory.create({
      data: {
        refundId: refund.id,
        fromStatus: RefundStatus.PENDING,
        toStatus: nextRefundStatus,
        note: dto.failureReason?.trim() || `Provider webhook event ${dto.eventId}`,
      },
    });

    const successful = await tx.refund.aggregate({
      where: { paymentId: payment.id, status: RefundStatus.SUCCEEDED },
      _sum: { amount: true },
    });
    const refundedAmount = successful._sum.amount ?? new Prisma.Decimal(0);
    if (refundedAmount.gt(payment.amount)) {
      throw new ConflictException('Successful refunds exceed payment amount');
    }
    const nextPaymentStatus = refundedAmount.equals(payment.amount)
      ? PaymentStatus.REFUNDED
      : refundedAmount.gt(0)
        ? PaymentStatus.PARTIALLY_REFUNDED
        : PaymentStatus.PAID;
    const updatedPayment = await tx.payment.updateMany({
      where: { id: payment.id, status: PaymentStatus.REFUND_PENDING },
      data: { status: nextPaymentStatus },
    });
    if (updatedPayment.count !== 1) throw new ConflictException('Payment changed concurrently');
    await tx.paymentStatusHistory.create({
      data: {
        paymentId: payment.id,
        fromStatus: PaymentStatus.REFUND_PENDING,
        toStatus: nextPaymentStatus,
        note: `Refund ${refund.id} became ${nextRefundStatus}`,
      },
    });
    await this.updateParentPaymentStatus(tx, payment.parentOrderId, nextPaymentStatus);
  }

  private verifyWebhookSignature(signature: string | undefined, timestamp: string | undefined, rawBody?: Buffer) {
    const secret = this.config.get<string>('BANK_TRANSFER_WEBHOOK_SECRET')?.trim();
    if (!secret) throw new ServiceUnavailableException('Bank transfer webhook is not configured');
    if (secret.length < 32) {
      throw new ServiceUnavailableException('Bank transfer webhook secret must contain at least 32 characters');
    }
    if (!rawBody?.length) throw new UnauthorizedException('Webhook raw body is unavailable');
    const normalizedTimestamp = timestamp?.trim();
    const timestampSeconds = Number(normalizedTimestamp);
    const tolerance = Number(this.config.get('PAYMENT_WEBHOOK_TOLERANCE_SECONDS') ?? 300);
    if (!normalizedTimestamp || !Number.isInteger(timestampSeconds)) {
      throw new UnauthorizedException('Webhook timestamp is invalid');
    }
    if (!Number.isFinite(tolerance) || tolerance < 30 || Math.abs(Date.now() / 1000 - timestampSeconds) > tolerance) {
      throw new UnauthorizedException('Webhook timestamp is outside the allowed window');
    }

    const suppliedHex = signature?.trim().replace(/^sha256=/, '');
    if (!suppliedHex || !/^[a-f0-9]{64}$/i.test(suppliedHex)) {
      throw new UnauthorizedException('Webhook signature is invalid');
    }
    const expectedHex = createHmac('sha256', secret)
      .update(`${normalizedTimestamp}.`)
      .update(rawBody)
      .digest('hex');
    const supplied = Buffer.from(suppliedHex, 'hex');
    const expected = Buffer.from(expectedHex, 'hex');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new UnauthorizedException('Webhook signature is invalid');
    }
  }

  private async updateParentPaymentStatus(
    tx: Prisma.TransactionClient,
    parentOrderId: string,
    status: PaymentStatus,
  ) {
    await tx.parentOrder.update({ where: { id: parentOrderId }, data: { paymentStatus: status } });
  }

  private webhookProvider() {
    return this.config.get<string>('BANK_TRANSFER_PROVIDER')?.trim() || 'bank-transfer';
  }

  private assertRefundChannelConfirmation(method: PaymentMethod, confirmation: boolean | undefined) {
    if (method === PaymentMethod.SEPAY) {
      throw new BadRequestException(
        'Automatic SePay bank-transfer refunds are not supported; handle the refund with an audited offline process',
      );
    }
    const offlineRefund = method === PaymentMethod.COD;
    if (offlineRefund && confirmation !== true) {
      throw new BadRequestException('COD refund requires explicit confirmation that cash was returned offline');
    }
    if (!offlineRefund && confirmation) {
      throw new BadRequestException('Offline confirmation is valid only for COD refunds');
    }
    return offlineRefund;
  }

  private requireSepay() {
    if (!this.sepay) throw new ServiceUnavailableException('SePay payment service is unavailable');
    return this.sepay;
  }

  private async findOwnedSepayPayment(userId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, parentOrder: { userId } },
      include: { parentOrder: { select: { id: true, orderNumber: true, userId: true } } },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.method !== PaymentMethod.SEPAY) {
      throw new BadRequestException('Payment does not use SePay');
    }
    return payment;
  }

  private normalizeSepayIpn(dto: SepayIpnDto) {
    const paymentId = this.requiredText(dto.order.order_invoice_number, 'SePay order invoice number');
    const orderStatus = this.requiredText(dto.order.order_status, 'SePay order status').toUpperCase();
    const transactionStatus = this.requiredText(
      dto.transaction.transaction_status,
      'SePay transaction status',
    ).toUpperCase();
    const currency = this.requiredText(
      dto.transaction.transaction_currency ?? dto.order.order_currency,
      'SePay currency',
    ).toUpperCase();
    if (orderStatus !== 'CAPTURED' || transactionStatus !== 'APPROVED') {
      throw new BadRequestException('SePay IPN does not contain an approved captured payment');
    }
    if (currency !== 'VND') throw new BadRequestException('SePay currency must be VND');
    const orderAmount = this.moneyText(dto.order.order_amount, 'SePay order amount');
    const transactionAmount = this.moneyText(
      dto.transaction.transaction_amount,
      'SePay transaction amount',
    );
    if (!new Prisma.Decimal(orderAmount).equals(transactionAmount)) {
      throw new BadRequestException('SePay order and transaction amounts do not match');
    }

    return {
      paymentId,
      eventId: this.requiredText(dto.transaction.id, 'SePay transaction ID'),
      providerReference: this.requiredText(
        dto.transaction.id,
        'SePay provider reference',
      ),
      amount: transactionAmount,
    };
  }

  private normalizeSepayOrder(payload: unknown, paymentId: string) {
    const root = this.record(payload) ?? {};
    const source = this.record(root.data) ?? this.record(root.order) ?? root;
    const order = this.record(source.order) ?? source;
    const transactions = Array.isArray(order.transactions)
      ? order.transactions
      : Array.isArray(source.transactions)
        ? source.transactions
        : [];
    const transaction = transactions
      .map((value) => this.record(value))
      .find((value) => this.optionalText(value?.transaction_status)?.toUpperCase() === 'APPROVED')
      ?? this.record(source.transaction)
      ?? this.record(order.transaction)
      ?? this.record(transactions[0])
      ?? {};
    const invoice = this.requiredText(
      order.order_invoice_number ?? source.order_invoice_number ?? paymentId,
      'SePay order invoice number',
    );
    if (invoice !== paymentId) throw new BadRequestException('SePay returned a different payment invoice');

    return {
      orderStatus: this.requiredText(
        order.order_status ?? source.order_status,
        'SePay order status',
      ).toUpperCase(),
      transactionStatus: this.requiredText(
        transaction.transaction_status ?? order.transaction_status ?? source.transaction_status,
        'SePay transaction status',
      ).toUpperCase(),
      currency: this.requiredText(
        order.order_currency ?? transaction.transaction_currency ?? source.order_currency,
        'SePay currency',
      ).toUpperCase(),
      amount: this.moneyText(
        order.order_amount ?? transaction.transaction_amount ?? source.order_amount,
        'SePay order amount',
      ),
      providerReference: this.requiredText(
        transaction.id ?? order.id ?? source.id,
        'SePay provider reference',
      ),
    };
  }

  private record(value: unknown): Record<string, unknown> | undefined {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : undefined;
  }

  private optionalText(value: unknown) {
    return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : undefined;
  }

  private requiredText(value: unknown, field: string) {
    const normalized = this.optionalText(value);
    if (!normalized) throw new BadRequestException(`${field} is missing`);
    return normalized;
  }

  private moneyText(value: unknown, field: string) {
    const normalized = this.requiredText(value, field);
    let amount: Prisma.Decimal;
    try {
      amount = new Prisma.Decimal(normalized);
    } catch {
      throw new BadRequestException(`${field} is invalid`);
    }
    if (!amount.isPositive() || amount.decimalPlaces() > 2) {
      throw new BadRequestException(`${field} is invalid`);
    }
    return amount.toFixed(2);
  }

  private async withSerializableRetry<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    conflictMessage: string,
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (this.isPrismaError(error, 'P2034') && attempt < 2) continue;
        if (this.isPrismaError(error, 'P2034')) throw new ConflictException(conflictMessage);
        throw error;
      }
    }
    throw new ConflictException(conflictMessage);
  }

  private isPrismaError(error: unknown, code: string) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
  }

  private assertMatchingRefundRequest(
    refund: { amount: Prisma.Decimal; reason: string | null },
    amount: Prisma.Decimal,
    reason: string | null,
  ) {
    if (!refund.amount.equals(amount) || refund.reason !== reason) {
      throw new ConflictException('Refund idempotency key was already used with a different request');
    }
  }
}
