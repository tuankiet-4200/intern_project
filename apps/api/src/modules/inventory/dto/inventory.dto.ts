import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { InventoryReason } from '@prisma/client';

export class AdjustInventoryDto {
  @IsInt()
  quantity!: number;

  @IsEnum(InventoryReason)
  reason!: InventoryReason;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ReserveInventoryDto {
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  referenceId?: string;
}
