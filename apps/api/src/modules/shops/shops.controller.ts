import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateShopDto, ReviewShopDto } from './dto/shops.dto';
import { ShopsService } from './shops.service';

@Controller('shops')
export class ShopsController {
  constructor(private readonly shops: ShopsService) {}

  @Get()
  findPublic() {
    return this.shops.findPublic();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER, UserRole.VENDOR)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateShopDto) {
    return this.shops.create(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER, UserRole.VENDOR)
  @Get('me')
  findMine(@CurrentUser() user: AuthUser) {
    return this.shops.findMine(user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/review-queue')
  findReviewQueue() {
    return this.shops.findReviewQueue();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':shopId/review')
  review(@Param('shopId') shopId: string, @Body() dto: ReviewShopDto) {
    return this.shops.review(shopId, dto);
  }
}
