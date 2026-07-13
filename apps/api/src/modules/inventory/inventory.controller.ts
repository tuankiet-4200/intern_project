import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdjustInventoryDto, ReserveInventoryDto } from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @Get('products/:productId')
  getByProduct(@Param('productId') productId: string) {
    return this.inventory.getByProduct(productId);
  }

  @Roles(UserRole.VENDOR)
  @Patch('products/:productId/adjust')
  adjust(@CurrentUser() user: AuthUser, @Param('productId') productId: string, @Body() dto: AdjustInventoryDto) {
    return this.inventory.adjust(user.sub, productId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Post('products/:productId/reserve')
  reserve(@Param('productId') productId: string, @Body() dto: ReserveInventoryDto) {
    return this.inventory.reserve(productId, dto);
  }
}
