import { Module } from '@nestjs/common';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';

@Module({
  imports: [RecommendationsModule],
  controllers: [WishlistController],
  providers: [WishlistService],
})
export class WishlistModule {}
