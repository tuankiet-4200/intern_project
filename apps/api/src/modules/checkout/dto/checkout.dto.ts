import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CheckoutQuoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  couponCode?: string;
}

export class CheckoutCommitDto extends CheckoutQuoteDto {
  @IsString()
  @MinLength(16)
  @MaxLength(100)
  idempotencyKey!: string;

  @IsUUID()
  addressId!: string;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;
}
