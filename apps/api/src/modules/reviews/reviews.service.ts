import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ShopOrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto, ReviewQueryDto, UpdateReviewDto } from './dto/reviews.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForProduct(productId: string, query: ReviewQueryDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, aggregate] = await Promise.all([
      this.prisma.review.findMany({
        where: { productId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { fullName: true } } },
      }),
      this.prisma.review.aggregate({
        where: { productId },
        _count: { _all: true },
        _avg: { rating: true },
      }),
    ]);

    return {
      items,
      total: aggregate._count._all,
      averageRating: aggregate._avg.rating ?? 0,
      page,
      limit,
    };
  }

  listMine(userId: string) {
    return this.prisma.review.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, name: true, slug: true, images: true } },
      },
    });
  }

  async create(userId: string, dto: CreateReviewDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const orderItem = await tx.orderItem.findFirst({
          where: {
            id: dto.orderItemId,
            shopOrder: { parentOrder: { userId } },
          },
          include: {
            shopOrder: { select: { status: true } },
          },
        });
        if (!orderItem) throw new NotFoundException('Delivered order item not found');
        if (orderItem.shopOrder.status !== ShopOrderStatus.DELIVERED) {
          throw new BadRequestException('Product can only be reviewed after delivery');
        }

        const existing = await tx.review.findUnique({
          where: { userId_orderItemId: { userId, orderItemId: orderItem.id } },
        });
        if (existing) throw new ConflictException('Order item has already been reviewed');

        return tx.review.create({
          data: {
            userId,
            productId: orderItem.productId,
            orderItemId: orderItem.id,
            rating: dto.rating,
            comment: this.normalizeComment(dto.comment),
          },
          include: { product: { select: { id: true, name: true, slug: true } } },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Order item has already been reviewed');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('Review changed concurrently; please retry');
      }
      throw error;
    }
  }

  async update(userId: string, reviewId: string, dto: UpdateReviewDto) {
    const review = await this.prisma.review.findFirst({ where: { id: reviewId, userId } });
    if (!review) throw new NotFoundException('Review not found');
    return this.prisma.review.update({
      where: { id: review.id },
      data: {
        rating: dto.rating,
        comment: dto.comment === undefined ? undefined : this.normalizeComment(dto.comment),
      },
      include: { product: { select: { id: true, name: true, slug: true } } },
    });
  }

  private normalizeComment(comment?: string) {
    const normalized = comment?.trim();
    return normalized || null;
  }
}
