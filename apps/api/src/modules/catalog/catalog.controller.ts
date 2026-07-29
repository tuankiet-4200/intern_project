import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CatalogService } from './catalog.service';
import {
  CreateCategoryDto,
  CreateProductDto,
  ProductQueryDto,
  UpdateCategoryDto,
  UpdateCategoryStatusDto,
  UpdateProductDto,
  UpdateProductStatusDto,
} from './dto/catalog.dto';

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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/categories')
  findAdminCategories() {
    return this.catalog.findAdminCategories();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('categories/:categoryId')
  updateCategory(@Param('categoryId', ParseIntPipe) categoryId: number, @Body() dto: UpdateCategoryDto) {
    return this.catalog.updateCategory(categoryId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('categories/:categoryId/status')
  updateCategoryStatus(
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Body() dto: UpdateCategoryStatusDto,
  ) {
    return this.catalog.updateCategoryStatus(categoryId, dto);
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
  @Roles(UserRole.VENDOR)
  @Post('shops/:shopId/products')
  createProduct(@CurrentUser() user: AuthUser, @Param('shopId') shopId: string, @Body() dto: CreateProductDto) {
    return this.catalog.createProduct(user.sub, shopId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('shops/:shopId/products')
  findVendorProducts(@CurrentUser() user: AuthUser, @Param('shopId') shopId: string) {
    return this.catalog.findVendorProducts(user.sub, shopId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch('products/:productId')
  updateProduct(@CurrentUser() user: AuthUser, @Param('productId') productId: string, @Body() dto: UpdateProductDto) {
    return this.catalog.updateProduct(user.sub, productId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch('products/:productId/status')
  updateProductStatus(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductStatusDto,
  ) {
    return this.catalog.updateProductStatus(user.sub, productId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch('products/:productId/archive')
  archiveProduct(@CurrentUser() user: AuthUser, @Param('productId') productId: string) {
    return this.catalog.archiveProduct(user.sub, productId);
  }
}
