import { IsEnum } from 'class-validator';
import { ShopOrderStatus } from '@prisma/client';

export class UpdateShopOrderStatusDto {
  @IsEnum(ShopOrderStatus)
  status!: ShopOrderStatus;
}
