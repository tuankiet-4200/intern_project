import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaymentsService } from './payments.service';
import { SepayGatewayService } from './sepay-gateway.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER, UserRole.VENDOR)
@Controller('payments/sepay')
export class CustomerPaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly sepay: SepayGatewayService,
  ) {}

  @Get('configuration')
  configuration() {
    return this.sepay.configuration();
  }

  @Post(':paymentId/checkout')
  createCheckout(
    @CurrentUser() user: AuthUser,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.payments.createSepayCheckout(user.sub, paymentId);
  }

  @Post(':paymentId/reconcile')
  reconcile(
    @CurrentUser() user: AuthUser,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.payments.reconcileSepayPayment(user.sub, paymentId);
  }
}
