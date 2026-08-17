import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ShopsController } from './shops.controller';
import { ShopsService } from './shops.service';
import { AdminShopsController } from './admin-shops.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [ShopsController, AdminShopsController],
  providers: [ShopsService],
  exports: [ShopsService],
})
export class ShopsModule {}
