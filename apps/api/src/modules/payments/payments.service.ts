import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdatePaymentStatusDto } from './dto/payments.dto';

const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  UNPAID: [PaymentStatus.AUTHORIZED, PaymentStatus.FAILED],
  AUTHORIZED: [PaymentStatus.PAID, PaymentStatus.FAILED],
  PAID: [],
  FAILED: [],
  REFUND_PENDING: [],
  REFUNDED: [],
};

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

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
          note: dto.note,
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
}
