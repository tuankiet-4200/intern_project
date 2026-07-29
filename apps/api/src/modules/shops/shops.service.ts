import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ShopStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateShopDto, ReviewShopDto } from './dto/shops.dto';

@Injectable()
export class ShopsService {
  constructor(private readonly prisma: PrismaService) {}

  findPublic() {
    return this.prisma.shop.findMany({
      where: { status: ShopStatus.APPROVED },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, slug: true, description: true, logoUrl: true, rating: true },
    });
  }

  findReviewQueue() {
    return this.prisma.shop.findMany({
      where: { status: ShopStatus.PENDING_REVIEW },
      orderBy: { createdAt: 'asc' },
      include: { owner: { select: { id: true, email: true, fullName: true } } },
    });
  }

  async create(ownerId: string, dto: CreateShopDto) {
    const existing = await this.prisma.shop.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new BadRequestException('Shop slug already exists');

    return this.prisma.shop.create({
      data: {
        ownerId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        logoUrl: dto.logoUrl,
      },
    });
  }

  async findMine(ownerId: string) {
    return this.prisma.shop.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async review(shopId: string, dto: ReviewShopDto) {
    const reviewableStatuses: ShopStatus[] = [
      ShopStatus.APPROVED,
      ShopStatus.REJECTED,
      ShopStatus.SUSPENDED,
    ];
    if (!reviewableStatuses.includes(dto.status)) {
      throw new BadRequestException('Invalid review status');
    }

    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Shop not found');

    return this.prisma.$transaction(async (tx) => {
      const updatedShop = await tx.shop.update({
        where: { id: shopId },
        data: { status: dto.status },
      });

      if (dto.status === ShopStatus.APPROVED) {
        await tx.user.updateMany({
          where: { id: shop.ownerId, role: 'CUSTOMER' },
          data: { role: 'VENDOR' },
        });
      }

      return updatedShop;
    });
  }

  async assertOwner(shopId: string, ownerId: string) {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Shop not found');
    if (shop.ownerId !== ownerId) throw new ForbiddenException('Not your shop');
    return shop;
  }
}
