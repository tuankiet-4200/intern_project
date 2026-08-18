import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CheckoutQuoteDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(99)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  cartItemIds?: string[];

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
