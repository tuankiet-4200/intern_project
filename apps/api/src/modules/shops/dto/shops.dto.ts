import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ShopStatus } from '@prisma/client';

export class CreateShopDto {
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  name!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;
}

export class ReviewShopDto {
  @IsEnum(ShopStatus)
  status!: ShopStatus;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason?: string;
}

export class AdminShopQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(ShopStatus)
  status?: ShopStatus;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class ShopStorefrontQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(140)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  limit = 20;
}
