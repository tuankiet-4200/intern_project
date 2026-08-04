import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UpdateShopOrderStatusDto } from './dto/orders.dto';
import { OrdersService } from './orders.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Roles(UserRole.CUSTOMER, UserRole.VENDOR)
  @Get('orders')
  listMine(@CurrentUser() user: AuthUser) {
    return this.orders.listMine(user.sub);
  }

  @Roles(UserRole.CUSTOMER, UserRole.VENDOR)
  @Get('orders/:orderId')
  getMine(@CurrentUser() user: AuthUser, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.orders.getMine(user.sub, orderId);
  }

  @Roles(UserRole.CUSTOMER, UserRole.VENDOR)
  @Patch('orders/:orderId/cancel')
  cancelMine(@CurrentUser() user: AuthUser, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.orders.cancelMine(user.sub, orderId);
  }

  @Roles(UserRole.VENDOR)
  @Get('shops/:shopId/orders')
  listForShop(@CurrentUser() user: AuthUser, @Param('shopId', ParseUUIDPipe) shopId: string) {
    return this.orders.listForShop(user.sub, shopId);
  }

  @Roles(UserRole.VENDOR)
  @Patch('shop-orders/:shopOrderId/status')
  updateShopOrderStatus(
    @CurrentUser() user: AuthUser,
    @Param('shopOrderId', ParseUUIDPipe) shopOrderId: string,
    @Body() dto: UpdateShopOrderStatusDto,
  ) {
    return this.orders.updateShopOrderStatus(user.sub, shopOrderId, dto.status);
  }
}
