import { PaymentStatus, PaymentWebhookType } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

export class UpdatePaymentStatusDto {
  @IsEnum(PaymentStatus)
  status!: PaymentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CreateRefundDto {
  @IsString()
  @Matches(MONEY_PATTERN, { message: 'amount must be a positive decimal with at most 2 decimal places' })
  amount!: string;

  @IsString()
  @Length(8, 100)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class BankTransferWebhookDto {
  @IsString()
  @Length(1, 100)
  eventId!: string;

  @IsEnum(PaymentWebhookType)
  type!: PaymentWebhookType;

  @IsUUID()
  paymentId!: string;

  @IsOptional()
  @IsUUID()
  refundId?: string;

  @IsString()
  @Length(1, 200)
  providerReference!: string;

  @IsString()
  @Matches(MONEY_PATTERN, { message: 'amount must be a positive decimal with at most 2 decimal places' })
  amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  failureReason?: string;
}
