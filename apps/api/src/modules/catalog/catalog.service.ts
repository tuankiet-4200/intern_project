import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProductStatus, ShopStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ShopsService } from '../shops/shops.service';
import { CreateCategoryDto, CreateProductDto, ProductQueryDto } from './dto/catalog.dto';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shops: ShopsService,
  ) {}

  findCategories() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { children: true },
    });
  }

  createCategory(dto: CreateCategoryDto) {
    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        parentId: dto.parentId,
      },
    });
  }

  async findPublicProducts(query: ProductQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);
    const where = {
      status: ProductStatus.ACTIVE,
      shop: { status: ShopStatus.APPROVED },
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { description: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          shop: { select: { id: true, name: true, slug: true } },
          category: { select: { id: true, name: true, slug: true } },
          inventory: true,
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  findProductBySlug(slug: string) {
    return this.prisma.product.findUnique({
      where: { slug },
      include: {
        shop: { select: { id: true, name: true, slug: true, status: true } },
        category: true,
        inventory: true,
      },
    });
  }

  async createProduct(ownerId: string, shopId: string, dto: CreateProductDto) {
    const shop = await this.shops.assertOwner(shopId, ownerId);
    if (shop.status === ShopStatus.SUSPENDED) throw new BadRequestException('Shop is suspended');

    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new NotFoundException('Category not found');

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          shopId,
          categoryId: dto.categoryId,
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          price: dto.price,
          status: dto.status ?? ProductStatus.DRAFT,
        },
      });

      const inventory = await tx.inventory.create({
        data: {
          productId: product.id,
          onHand: dto.initialStock ?? 0,
          ledger: {
            create: {
              deltaOnHand: dto.initialStock ?? 0,
              reason: 'INITIAL_STOCK',
              note: 'Initial product stock',
            },
          },
        },
      });

      return { ...product, inventory };
    });
  }

  findVendorProducts(ownerId: string, shopId: string) {
    return this.shops.assertOwner(shopId, ownerId).then(() =>
      this.prisma.product.findMany({
        where: { shopId },
        orderBy: { createdAt: 'desc' },
        include: { inventory: true, category: true },
      }),
    );
  }
}
