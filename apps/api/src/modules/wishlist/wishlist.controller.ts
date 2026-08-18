import { Controller, Delete, Get, Param, ParseUUIDPipe, Put, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WishlistQueryDto } from './dto/wishlist.dto';
import { WishlistService } from './wishlist.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER, UserRole.VENDOR)
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: WishlistQueryDto) {
    return this.wishlist.list(user.sub, query);
  }

  @Get('product-ids')
  productIds(@CurrentUser() user: AuthUser) {
    return this.wishlist.productIds(user.sub);
  }

  @Put('items/:productId')
  add(@CurrentUser() user: AuthUser, @Param('productId', ParseUUIDPipe) productId: string) {
    return this.wishlist.add(user.sub, productId);
  }

  @Delete('items/:productId')
  remove(@CurrentUser() user: AuthUser, @Param('productId', ParseUUIDPipe) productId: string) {
    return this.wishlist.remove(user.sub, productId);
  }
}
