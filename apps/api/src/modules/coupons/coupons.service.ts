import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CouponScope, CouponType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CouponQueryDto, CreateCouponDto, UpdateCouponDto } from './dto/coupons.dto';

type CampaignState = {
  code: string;
  scope: CouponScope;
  shopId: string | null;
  type: CouponType;
  value: Prisma.Decimal;
  minOrderAmount: Prisma.Decimal | null;
  maxDiscount: Prisma.Decimal | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  startsAt: Date | null;
  expiresAt: Date | null;
};

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: CouponQueryDto) {
    const where: Prisma.CouponWhereInput = {
      scope: query.scope,
      isActive: query.isActive === undefined ? undefined : query.isActive === 'true',
      code: query.search?.trim()
        ? { contains: query.search.trim(), mode: 'insensitive' }
        : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        include: {
          shop: { select: { id: true, name: true, slug: true, status: true } },
          _count: { select: { usages: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { code: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.coupon.count({ where }),
    ]);
    return { data, total, page: query.page, limit: query.limit };
  }

  async create(dto: CreateCouponDto) {
    const campaign: CampaignState = {
      code: this.normalizeCode(dto.code),
      scope: dto.scope,
      shopId: dto.scope === CouponScope.SHOP ? dto.shopId ?? null : null,
      type: dto.type,
      value: new Prisma.Decimal(dto.value),
      minOrderAmount: dto.minOrderAmount ? new Prisma.Decimal(dto.minOrderAmount) : null,
      maxDiscount: dto.maxDiscount ? new Prisma.Decimal(dto.maxDiscount) : null,
      usageLimit: dto.usageLimit ?? null,
      perUserLimit: dto.perUserLimit ?? null,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    };
    await this.validateCampaign(campaign);
    if ((dto.isActive ?? true) && campaign.expiresAt && campaign.expiresAt <= new Date()) {
      throw new BadRequestException('Expired coupon cannot be created as active');
    }
    try {
      return await this.prisma.coupon.create({
        data: { ...campaign, isActive: dto.isActive ?? true },
        include: { shop: { select: { id: true, name: true, slug: true } } },
      });
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('Coupon code already exists');
      throw error;
    }
  }

  async update(couponId: string, dto: UpdateCouponDto) {
    return this.prisma.$transaction(async (tx) => {
      const coupon = await tx.coupon.findUnique({
        where: { id: couponId },
        include: { _count: { select: { usages: true } } },
      });
      if (!coupon) throw new NotFoundException('Coupon not found');

      const scope = dto.scope ?? coupon.scope;
      const campaign: CampaignState = {
        code: dto.code === undefined ? coupon.code : this.normalizeCode(dto.code),
        scope,
        shopId: scope === CouponScope.GLOBAL
          ? null
          : dto.shopId === undefined ? coupon.shopId : dto.shopId,
        type: dto.type ?? coupon.type,
        value: dto.value === undefined ? coupon.value : new Prisma.Decimal(dto.value),
        minOrderAmount: this.mergeDecimal(dto.minOrderAmount, coupon.minOrderAmount),
        maxDiscount: this.mergeDecimal(dto.maxDiscount, coupon.maxDiscount),
        usageLimit: dto.usageLimit === undefined ? coupon.usageLimit : dto.usageLimit,
        perUserLimit: dto.perUserLimit === undefined ? coupon.perUserLimit : dto.perUserLimit,
        startsAt: this.mergeDate(dto.startsAt, coupon.startsAt),
        expiresAt: this.mergeDate(dto.expiresAt, coupon.expiresAt),
      };
      await this.validateCampaign(campaign, tx);
      if (coupon.isActive && campaign.expiresAt && campaign.expiresAt <= new Date()) {
        throw new BadRequestException('Deactivate coupon before setting an expired schedule');
      }

      if (coupon._count.usages > 0 && this.economicTermsChanged(coupon, campaign)) {
        throw new BadRequestException('Code, scope, shop, type, and value cannot change after coupon usage');
      }
      if (campaign.usageLimit !== null && campaign.usageLimit < coupon.usedCount) {
        throw new BadRequestException(`Usage limit cannot be lower than used count ${coupon.usedCount}`);
      }
      if (campaign.perUserLimit !== null) {
        const usageByUser = await tx.couponUsage.groupBy({
          by: ['userId'],
          where: { couponId },
          _count: { _all: true },
        });
        const highestUsage = usageByUser.reduce((max, item) => Math.max(max, item._count._all), 0);
        if (campaign.perUserLimit < highestUsage) {
          throw new BadRequestException(`Per-user limit cannot be lower than existing usage ${highestUsage}`);
        }
      }

      try {
        return await tx.coupon.update({
          where: { id: couponId },
          data: campaign,
          include: {
            shop: { select: { id: true, name: true, slug: true, status: true } },
            _count: { select: { usages: true } },
          },
        });
      } catch (error) {
        if (this.isUniqueError(error)) throw new ConflictException('Coupon code already exists');
        throw error;
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async updateStatus(couponId: string, isActive: boolean) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id: couponId } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    if (isActive) {
      if (coupon.expiresAt && coupon.expiresAt <= new Date()) {
        throw new BadRequestException('Expired coupon cannot be activated');
      }
      if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
        throw new BadRequestException('Exhausted coupon cannot be activated');
      }
    }
    return this.prisma.coupon.update({ where: { id: couponId }, data: { isActive } });
  }

  private async validateCampaign(campaign: CampaignState, tx: Prisma.TransactionClient | PrismaService = this.prisma) {
    if (campaign.value.lte(0)) throw new BadRequestException('Coupon value must be greater than zero');
    if (campaign.usageLimit !== null && campaign.usageLimit < 1) {
      throw new BadRequestException('Usage limit must be greater than zero');
    }
    if (campaign.perUserLimit !== null && campaign.perUserLimit < 1) {
      throw new BadRequestException('Per-user limit must be greater than zero');
    }
    if (campaign.type === CouponType.PERCENTAGE && campaign.value.gt(100)) {
      throw new BadRequestException('Percentage coupon value cannot exceed 100');
    }
    if (campaign.minOrderAmount?.lt(0)) throw new BadRequestException('Minimum order amount cannot be negative');
    if (campaign.maxDiscount?.lte(0)) throw new BadRequestException('Maximum discount must be greater than zero');
    if (campaign.startsAt && campaign.expiresAt && campaign.startsAt >= campaign.expiresAt) {
      throw new BadRequestException('Coupon start must be before expiry');
    }
    if (
      campaign.usageLimit !== null
      && campaign.perUserLimit !== null
      && campaign.perUserLimit > campaign.usageLimit
    ) {
      throw new BadRequestException('Per-user limit cannot exceed total usage limit');
    }
    if (campaign.scope === CouponScope.GLOBAL && campaign.shopId !== null) {
      throw new BadRequestException('Global coupon cannot reference a shop');
    }
    if (campaign.scope === CouponScope.SHOP) {
      if (!campaign.shopId) throw new BadRequestException('Shop coupon requires shopId');
      const shop = await tx.shop.findUnique({ where: { id: campaign.shopId }, select: { id: true } });
      if (!shop) throw new NotFoundException('Shop not found');
    }
  }

  private economicTermsChanged(
    coupon: { code: string; scope: CouponScope; shopId: string | null; type: CouponType; value: Prisma.Decimal },
    campaign: CampaignState,
  ) {
    return coupon.code !== campaign.code
      || coupon.scope !== campaign.scope
      || coupon.shopId !== campaign.shopId
      || coupon.type !== campaign.type
      || !coupon.value.equals(campaign.value);
  }

  private mergeDecimal(value: string | null | undefined, current: Prisma.Decimal | null) {
    return value === undefined ? current : value === null ? null : new Prisma.Decimal(value);
  }

  private mergeDate(value: string | null | undefined, current: Date | null) {
    return value === undefined ? current : value === null ? null : new Date(value);
  }

  private normalizeCode(code: string) {
    return code.trim().toUpperCase();
  }

  private isUniqueError(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
