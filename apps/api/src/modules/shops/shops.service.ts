import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, AdminActionType, NotificationType, Prisma, ShopStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminShopQueryDto, CreateShopDto, ReviewShopDto } from './dto/shops.dto';
import { OutboxService } from '../notifications/outbox.service';

const SHOP_STATUS_TRANSITIONS: Record<ShopStatus, ShopStatus[]> = {
  [ShopStatus.PENDING_REVIEW]: [ShopStatus.APPROVED, ShopStatus.REJECTED],
  [ShopStatus.APPROVED]: [ShopStatus.SUSPENDED],
  [ShopStatus.REJECTED]: [ShopStatus.PENDING_REVIEW],
  [ShopStatus.SUSPENDED]: [ShopStatus.APPROVED, ShopStatus.REJECTED],
};

@Injectable()
export class ShopsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox?: OutboxService,
  ) {}

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

  async adminList(query: AdminShopQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.ShopWhereInput = {
      status: query.status,
      ownerId: query.ownerId,
      ...(search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
          { owner: { email: { contains: search, mode: 'insensitive' } } },
          { owner: { fullName: { contains: search, mode: 'insensitive' } } },
        ],
      } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.shop.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          logoUrl: true,
          status: true,
          rating: true,
          aiChatEnabled: true,
          createdAt: true,
          updatedAt: true,
          owner: { select: { id: true, email: true, fullName: true, role: true, status: true } },
          _count: { select: { products: true, shopOrders: true, chatConversations: true } },
        },
      }),
      this.prisma.shop.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) };
  }

  async adminDetail(shopId: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logoUrl: true,
        status: true,
        rating: true,
        aiChatEnabled: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, email: true, fullName: true, role: true, status: true } },
        products: {
          orderBy: { updatedAt: 'desc' },
          take: 20,
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            price: true,
            updatedAt: true,
            inventory: { select: { onHand: true, reserved: true, sold: true } },
          },
        },
        _count: { select: { products: true, shopOrders: true, coupons: true, chatConversations: true } },
      },
    });
    if (!shop) throw new NotFoundException('Shop not found');
    const auditLogs = await this.prisma.adminAuditLog.findMany({
      where: { targetType: 'Shop', targetId: shopId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { actor: { select: { id: true, fullName: true, email: true } } },
    });
    return { ...shop, auditLogs };
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

  async adminUpdateStatus(adminId: string, shopId: string, dto: ReviewShopDto) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      include: { owner: { select: { status: true } } },
    });
    if (!shop) throw new NotFoundException('Shop not found');
    if (shop.status === dto.status) return shop;
    if (!SHOP_STATUS_TRANSITIONS[shop.status].includes(dto.status)) {
      throw new BadRequestException(`Cannot change shop status from ${shop.status} to ${dto.status}`);
    }
    if ((dto.status === ShopStatus.REJECTED || dto.status === ShopStatus.SUSPENDED) && !dto.reason?.trim()) {
      throw new BadRequestException('A reason is required when rejecting or suspending a shop');
    }
    if (dto.status === ShopStatus.APPROVED && shop.owner.status !== AccountStatus.ACTIVE) {
      throw new BadRequestException('Cannot approve a shop whose owner account is not active');
    }

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

      await tx.adminAuditLog.create({
        data: {
          actorId: adminId,
          action: AdminActionType.SHOP_STATUS_CHANGED,
          targetType: 'Shop',
          targetId: shopId,
          reason: dto.reason?.trim() || null,
          before: { status: shop.status },
          after: { status: dto.status },
        },
      });

      if (this.outbox) await this.outbox.enqueue(tx, {
        userId: shop.ownerId,
        type: NotificationType.SHOP_REVIEWED,
        title: `Shop ${dto.status === ShopStatus.APPROVED ? 'approved' : 'review updated'}`,
        message: `${shop.name} is now ${dto.status}.`,
        data: { shopId: shop.id, status: dto.status },
        aggregateType: 'Shop',
        aggregateId: shop.id,
      });

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
