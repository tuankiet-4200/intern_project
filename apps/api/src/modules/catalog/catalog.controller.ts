import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CatalogService } from './catalog.service';
import { CreateCategoryDto, CreateProductDto, ProductQueryDto } from './dto/catalog.dto';

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  findCategories() {
    return this.catalog.findCategories();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.catalog.createCategory(dto);
  }

  @Get('products')
  findProducts(@Query() query: ProductQueryDto) {
    return this.catalog.findPublicProducts(query);
  }

  @Get('products/:slug')
  findProduct(@Param('slug') slug: string) {
    return this.catalog.findProductBySlug(slug);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @Post('shops/:shopId/products')
  createProduct(@CurrentUser() user: AuthUser, @Param('shopId') shopId: string, @Body() dto: CreateProductDto) {
    return this.catalog.createProduct(user.sub, shopId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @Get('shops/:shopId/products')
  findVendorProducts(@CurrentUser() user: AuthUser, @Param('shopId') shopId: string) {
    return this.catalog.findVendorProducts(user.sub, shopId);
  }
}
