import { PaymentMethod, PaymentStatus, PaymentWebhookType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  Max,
  Min,
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

  @IsOptional()
  @IsBoolean()
  confirmOfflineRefund?: boolean;
}

export class PaymentQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;
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

export class SepayIpnDto {
  @IsInt()
  timestamp!: number;

  @IsString()
  @MaxLength(50)
  notification_type!: string;

  @IsObject()
  order!: Record<string, unknown>;

  @IsObject()
  transaction!: Record<string, unknown>;

  @IsObject()
  customer!: Record<string, unknown>;
}
