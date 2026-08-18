import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { CustomerPaymentsController } from './customer-payments.controller';
import { PaymentWebhookController } from './payment-webhook.controller';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { SepayGatewayService } from './sepay-gateway.service';

@Module({
  imports: [NotificationsModule],
  controllers: [PaymentsController, PaymentWebhookController, CustomerPaymentsController],
  providers: [PaymentsService, SepayGatewayService],
  exports: [PaymentsService, SepayGatewayService],
})
export class PaymentsModule {}
