import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
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
}
