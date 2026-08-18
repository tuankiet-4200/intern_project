import { Module } from '@nestjs/common';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [RecommendationsModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
