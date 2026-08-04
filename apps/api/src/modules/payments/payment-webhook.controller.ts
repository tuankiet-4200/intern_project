import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { BankTransferWebhookDto } from './dto/payments.dto';
import { PaymentsService } from './payments.service';

@Controller('payments/webhooks')
export class PaymentWebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('bank-transfer')
  @HttpCode(200)
  handleBankTransfer(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-webhook-signature') signature: string | undefined,
    @Headers('x-webhook-timestamp') timestamp: string | undefined,
    @Body() dto: BankTransferWebhookDto,
  ) {
    return this.payments.processBankTransferWebhook(signature, timestamp, request.rawBody, dto);
  }
}
