import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { OutboxService } from './outbox.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, OutboxService],
  exports: [OutboxService],
})
export class NotificationsModule {}
