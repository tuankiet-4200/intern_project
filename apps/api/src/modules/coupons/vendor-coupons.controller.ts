import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CouponsService } from './coupons.service';
import { CouponQueryDto, CreateCouponDto, UpdateCouponDto, UpdateCouponStatusDto } from './dto/coupons.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VENDOR)
@Controller('vendor/coupons')
export class VendorCouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: CouponQueryDto) {
    return this.coupons.listForVendor(user.sub, query);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCouponDto) {
    return this.coupons.createForVendor(user.sub, dto);
  }

  @Patch(':couponId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('couponId', ParseUUIDPipe) couponId: string,
    @Body() dto: UpdateCouponDto,
  ) {
    return this.coupons.updateForVendor(user.sub, couponId, dto);
  }

  @Patch(':couponId/status')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('couponId', ParseUUIDPipe) couponId: string,
    @Body() dto: UpdateCouponStatusDto,
  ) {
    return this.coupons.updateStatusForVendor(user.sub, couponId, dto.isActive);
  }
}
