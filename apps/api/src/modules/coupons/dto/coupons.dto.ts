import { CouponScope, CouponType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,49}$/i;
const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

export class CreateCouponDto {
  @IsString()
  @Matches(CODE_PATTERN)
  code!: string;

  @IsEnum(CouponScope)
  scope!: CouponScope;

  @IsOptional()
  @IsUUID()
  shopId?: string;

  @IsEnum(CouponType)
  type!: CouponType;

  @IsString()
  @Matches(MONEY_PATTERN)
  value!: string;

  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN)
  minOrderAmount?: string;

  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN)
  maxDiscount?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  perUserLimit?: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCouponDto {
  @IsOptional()
  @IsString()
  @Matches(CODE_PATTERN)
  code?: string;

  @IsOptional()
  @IsEnum(CouponScope)
  scope?: CouponScope;

  @IsOptional()
  @IsUUID()
  shopId?: string | null;

  @IsOptional()
  @IsEnum(CouponType)
  type?: CouponType;

  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN)
  value?: string;

  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN)
  minOrderAmount?: string | null;

  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN)
  maxDiscount?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usageLimit?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  perUserLimit?: number | null;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}

export class UpdateCouponStatusDto {
  @IsBoolean()
  isActive!: boolean;
}

export class CouponQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(CouponScope)
  scope?: CouponScope;

  @IsOptional()
  @IsIn(['true', 'false'])
  isActive?: 'true' | 'false';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
