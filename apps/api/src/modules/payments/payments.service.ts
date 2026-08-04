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
  PaymentStatus,
  PaymentWebhookType,
  Prisma,
  RefundStatus,
} from '@prisma/client';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BankTransferWebhookDto,
  CreateRefundDto,
  UpdatePaymentStatusDto,
} from './dto/payments.dto';

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
  ) {}

  async updateStatus(actorId: string, paymentId: string, dto: UpdatePaymentStatusDto) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
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
        const existing = await tx.refund.findUnique({
          where: { paymentId_idempotencyKey: { paymentId, idempotencyKey } },
          include: { statusHistory: { orderBy: { createdAt: 'asc' } } },
        });
        if (existing) {
          this.assertMatchingRefundRequest(existing, amount, reason);
          return existing;
        }

        const payment = await tx.payment.findUnique({ where: { id: paymentId } });
        if (!payment) throw new NotFoundException('Payment not found');
        if (payment.method !== PaymentMethod.BANK_TRANSFER) {
          throw new BadRequestException('Provider-backed refunds currently support bank transfer payments only');
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

        const claimed = await tx.payment.updateMany({
          where: { id: payment.id, status: payment.status },
          data: { status: PaymentStatus.REFUND_PENDING },
        });
        if (claimed.count !== 1) throw new ConflictException('Payment changed concurrently; retry refund request');

        const refund = await tx.refund.create({
          data: {
            paymentId,
            requestedById: actorId,
            idempotencyKey,
            amount,
            reason,
            provider: this.webhookProvider(),
            statusHistory: {
              create: {
                fromStatus: null,
                toStatus: RefundStatus.PENDING,
                actorId,
                note: reason,
              },
            },
          },
          include: { statusHistory: { orderBy: { createdAt: 'asc' } } },
        });
        await tx.paymentStatusHistory.create({
          data: {
            paymentId,
            fromStatus: payment.status,
            toStatus: PaymentStatus.REFUND_PENDING,
            actorId,
            note: `Refund requested: ${refund.id}`,
          },
        });
        await tx.parentOrder.update({
          where: { id: payment.parentOrderId },
          data: { paymentStatus: PaymentStatus.REFUND_PENDING },
        });
        return refund;
      }, 'Refund changed concurrently; please retry');
    } catch (error) {
      if (!this.isPrismaError(error, 'P2002')) throw error;
      const existing = await this.prisma.refund.findUnique({
        where: { paymentId_idempotencyKey: { paymentId, idempotencyKey } },
        include: { statusHistory: { orderBy: { createdAt: 'asc' } } },
      });
      if (!existing) throw new ConflictException('Refund idempotency key or provider reference already exists');
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

    const isRefundEvent = REFUND_WEBHOOK_TYPES.has(dto.type);
    if (isRefundEvent !== Boolean(dto.refundId)) {
      throw new BadRequestException('refundId is required only for refund webhook events');
    }

    const provider = this.webhookProvider();
    const payloadHash = createHash('sha256').update(rawBody).digest('hex');
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const payment = await tx.payment.findUnique({ where: { id: dto.paymentId } });
          if (!payment) throw new NotFoundException('Payment not found');
          if (payment.method !== PaymentMethod.BANK_TRANSFER) {
            throw new BadRequestException('Webhook can settle bank transfer payments only');
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
