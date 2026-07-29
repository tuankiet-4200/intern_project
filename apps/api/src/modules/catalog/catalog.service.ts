import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ProductStatus, ShopStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ShopsService } from '../shops/shops.service';
import {
  CreateCategoryDto,
  CreateProductDto,
  ProductQueryDto,
  UpdateCategoryDto,
  UpdateCategoryStatusDto,
  UpdateProductDto,
  UpdateProductStatusDto,
} from './dto/catalog.dto';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shops: ShopsService,
  ) {}

  async findCategories() {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const nodes = new Map(categories.map((category) => [category.id, { ...category, children: [] as typeof categories }]));
    const roots: Array<(typeof categories)[number] & { children: typeof categories }> = [];
    for (const category of categories) {
      const node = nodes.get(category.id)!;
      const parent = category.parentId === null ? undefined : nodes.get(category.parentId);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    return roots;
  }

  findAdminCategories() {
    return this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { children: true, products: true } },
      },
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    await this.assertValidCategoryParent(undefined, dto.parentId);
    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        parentId: dto.parentId,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async updateCategory(categoryId: number, dto: UpdateCategoryDto) {
    await this.assertCategoryExists(categoryId);
    if (dto.parentId !== undefined) {
      await this.assertValidCategoryParent(categoryId, dto.parentId ?? undefined);
    }

    return this.prisma.category.update({
      where: { id: categoryId },
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        parentId: dto.parentId,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async updateCategoryStatus(categoryId: number, dto: UpdateCategoryStatusDto) {
    await this.assertCategoryExists(categoryId);
    if (!dto.isActive) {
      const [activeChildren, activeProducts] = await Promise.all([
        this.prisma.category.count({ where: { parentId: categoryId, isActive: true } }),
        this.prisma.product.count({
          where: { categoryId, status: { in: [ProductStatus.DRAFT, ProductStatus.ACTIVE] } },
        }),
      ]);
      if (activeChildren > 0) throw new BadRequestException('Deactivate child categories first');
      if (activeProducts > 0) throw new BadRequestException('Archive or move category products first');
    }

    return this.prisma.category.update({
      where: { id: categoryId },
      data: { isActive: dto.isActive },
    });
  }

  async findPublicProducts(query: ProductQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);
    const where = {
      status: ProductStatus.ACTIVE,
      shop: { status: ShopStatus.APPROVED },
      inventory: {
        is: {
          onHand: { gt: this.prisma.inventory.fields.reserved },
        },
      },
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
    return this.prisma.product.findFirst({
      where: {
        slug,
        status: ProductStatus.ACTIVE,
        shop: { status: ShopStatus.APPROVED },
        inventory: {
          is: {
            onHand: { gt: this.prisma.inventory.fields.reserved },
          },
        },
      },
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
    if (!category.isActive) throw new BadRequestException('Category is inactive');

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

  async updateProduct(ownerId: string, productId: string, dto: UpdateProductDto) {
    const product = await this.assertProductOwner(productId, ownerId);
    if (product.status === ProductStatus.ARCHIVED) {
      throw new BadRequestException('Archived product cannot be edited');
    }
    if (dto.categoryId !== undefined) await this.assertActiveCategory(dto.categoryId);

    return this.prisma.product.update({
      where: { id: productId },
      data: {
        name: dto.name,
        slug: dto.slug,
        categoryId: dto.categoryId,
        price: dto.price,
        description: dto.description,
      },
      include: { inventory: true, category: true },
    });
  }

  async updateProductStatus(ownerId: string, productId: string, dto: UpdateProductStatusDto) {
    const product = await this.assertProductOwner(productId, ownerId);
    if (dto.status === ProductStatus.ARCHIVED) {
      throw new BadRequestException('Use the archive endpoint');
    }
    if (product.status === ProductStatus.ARCHIVED) {
      throw new BadRequestException('Archived product cannot be reactivated');
    }
    if (dto.status === ProductStatus.ACTIVE) {
      if (product.shop.status !== ShopStatus.APPROVED) {
        throw new BadRequestException('Shop must be approved before activating products');
      }
      await this.assertActiveCategory(product.categoryId);
    }

    return this.prisma.product.update({
      where: { id: productId },
      data: { status: dto.status },
      include: { inventory: true, category: true },
    });
  }

  async archiveProduct(ownerId: string, productId: string) {
    await this.assertProductOwner(productId, ownerId);
    return this.prisma.product.update({
      where: { id: productId },
      data: { status: ProductStatus.ARCHIVED },
      include: { inventory: true, category: true },
    });
  }

  private async assertProductOwner(productId: string, ownerId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { shop: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.shop.ownerId !== ownerId) throw new ForbiddenException('Not your product');
    return product;
  }

  private async assertCategoryExists(categoryId: number) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  private async assertActiveCategory(categoryId: number) {
    const category = await this.assertCategoryExists(categoryId);
    if (!category.isActive) throw new BadRequestException('Category is inactive');
    return category;
  }

  private async assertValidCategoryParent(categoryId?: number, parentId?: number) {
    if (parentId === undefined) return;

    let current = await this.assertActiveCategory(parentId);
    while (current) {
      if (categoryId !== undefined && current.id === categoryId) {
        throw new BadRequestException('Category parent would create a cycle');
      }
      if (current.parentId === null) return;
      current = await this.assertCategoryExists(current.parentId);
    }
  }
}
