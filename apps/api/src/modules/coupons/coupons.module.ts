import { Module } from '@nestjs/common';
import { AvailableCouponsController } from './available-coupons.controller';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import { VendorCouponsController } from './vendor-coupons.controller';

@Module({
  controllers: [CouponsController, VendorCouponsController, AvailableCouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
