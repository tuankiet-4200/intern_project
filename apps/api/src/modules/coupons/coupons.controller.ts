import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CouponsService } from './coupons.service';
import { CouponQueryDto, CreateCouponDto, UpdateCouponDto, UpdateCouponStatusDto } from './dto/coupons.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/coupons')
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get()
  list(@Query() query: CouponQueryDto) {
    return this.coupons.list(query);
  }

  @Post()
  create(@Body() dto: CreateCouponDto) {
    return this.coupons.create(dto);
  }

  @Patch(':couponId')
  update(@Param('couponId', ParseUUIDPipe) couponId: string, @Body() dto: UpdateCouponDto) {
    return this.coupons.update(couponId, dto);
  }

  @Patch(':couponId/status')
  updateStatus(
    @Param('couponId', ParseUUIDPipe) couponId: string,
    @Body() dto: UpdateCouponStatusDto,
  ) {
    return this.coupons.updateStatus(couponId, dto.isActive);
  }
}
