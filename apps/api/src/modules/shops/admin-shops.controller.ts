import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminShopQueryDto, ReviewShopDto } from './dto/shops.dto';
import { ShopsService } from './shops.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/shops')
export class AdminShopsController {
  constructor(private readonly shops: ShopsService) {}

  @Get()
  list(@Query() query: AdminShopQueryDto) {
    return this.shops.adminList(query);
  }

  @Get(':shopId')
  detail(@Param('shopId', ParseUUIDPipe) shopId: string) {
    return this.shops.adminDetail(shopId);
  }

  @Patch(':shopId/status')
  updateStatus(
    @CurrentUser() admin: AuthUser,
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Body() dto: ReviewShopDto,
  ) {
    return this.shops.adminUpdateStatus(admin.sub, shopId, dto);
  }
}
