import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateRefundDto, PaymentQueryDto, UpdatePaymentStatusDto } from './dto/payments.dto';
import { PaymentsService } from './payments.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  list(@Query() query: PaymentQueryDto) {
    return this.payments.listForAdmin(query);
  }

  @Patch(':paymentId/status')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: UpdatePaymentStatusDto,
  ) {
    return this.payments.updateStatus(user.sub, paymentId, dto);
  }

  @Post(':paymentId/refunds')
  createRefund(
    @CurrentUser() user: AuthUser,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: CreateRefundDto,
  ) {
    return this.payments.createRefund(user.sub, paymentId, dto);
  }

  @Get(':paymentId/refunds')
  listRefunds(@Param('paymentId', ParseUUIDPipe) paymentId: string) {
    return this.payments.listRefunds(paymentId);
  }
}
