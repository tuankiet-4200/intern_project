import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProductStatus, ShopStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WishlistQueryDto } from './dto/wishlist.dto';

const WISHLIST_PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  price: true,
  compareAtPrice: true,
  images: true,
  status: true,
  shop: { select: { id: true, name: true, slug: true, status: true } },
  category: { select: { id: true, name: true, slug: true } },
  inventory: { select: { onHand: true, reserved: true } },
} as const;

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: WishlistQueryDto) {
    const where = { userId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.wishlistItem.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          createdAt: true,
          product: { select: WISHLIST_PRODUCT_SELECT },
        },
      }),
      this.prisma.wishlistItem.count({ where }),
    ]);

    const items = rows.map((row) => {
      const available = Math.max(0, (row.product.inventory?.onHand ?? 0) - (row.product.inventory?.reserved ?? 0));
      const isPurchasable = row.product.status === ProductStatus.ACTIVE
        && row.product.shop.status === ShopStatus.APPROVED
        && available > 0;
      return { ...row, product: { ...row.product, available, isPurchasable } };
    });
    return { items, total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) };
  }

  async productIds(userId: string) {
    const items = await this.prisma.wishlistItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { productId: true },
    });
    return { productIds: items.map((item) => item.productId) };
  }

  async add(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, status: true, shop: { select: { status: true } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.status !== ProductStatus.ACTIVE || product.shop.status !== ShopStatus.APPROVED) {
      throw new BadRequestException('Only active products from approved shops can be added to a wishlist');
    }

    await this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId, productId } },
      update: {},
      create: { userId, productId },
    });
    return { productId, wished: true };
  }

  async remove(userId: string, productId: string) {
    await this.prisma.wishlistItem.deleteMany({ where: { userId, productId } });
    return { productId, wished: false };
  }
}
