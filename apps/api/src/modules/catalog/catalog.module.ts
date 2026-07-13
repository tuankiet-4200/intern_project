import { Module } from '@nestjs/common';
import { ShopsModule } from '../shops/shops.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [ShopsModule],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
