import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CheckoutService } from './checkout.service';
import { CheckoutCommitDto, CheckoutQuoteDto } from './dto/checkout.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER, UserRole.VENDOR)
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post('quote')
  quote(@CurrentUser() user: AuthUser, @Body() dto: CheckoutQuoteDto) {
    return this.checkout.quote(user.sub, dto);
  }

  @Post('commit')
  commit(@CurrentUser() user: AuthUser, @Body() dto: CheckoutCommitDto) {
    return this.checkout.commit(user.sub, dto);
  }
}
