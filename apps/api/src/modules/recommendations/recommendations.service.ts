import { Injectable, NotFoundException } from '@nestjs/common';
import { InteractionType, Prisma, ProductStatus, ShopStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RecommendationQueryDto } from './dto/recommendations.dto';
import { candidateRecommendationScore, interactionSignalScore } from './recommendation-ranking';

type DbClient = PrismaService | Prisma.TransactionClient;

const RECOMMENDATION_PRODUCT_INCLUDE = {
  shop: { select: { id: true, name: true, slug: true } },
  category: { select: { id: true, name: true, slug: true } },
  inventory: true,
} as const;

@Injectable()
export class RecommendationsService {
  private static readonly MAX_INTERACTIONS = 100;
  private static readonly MAX_CANDIDATES = 80;

  constructor(private readonly prisma: PrismaService) {}

  async publicRecommendations(query: RecommendationQueryDto) {
    const limit = this.limit(query.limit);
    const items = await this.findTrending(limit, query.search);
    return { items, personalized: false, reason: 'TRENDING' as const };
  }

  async personalizedRecommendations(userId: string, query: RecommendationQueryDto) {
    const limit = this.limit(query.limit);
    const interactions = await this.prisma.userInteraction.findMany({
      where: { userId },
      orderBy: [{ lastInteractedAt: 'desc' }, { id: 'desc' }],
      take: RecommendationsService.MAX_INTERACTIONS,
      include: { product: { select: { categoryId: true, shopId: true } } },
    });

    if (interactions.length === 0) return this.publicRecommendations(query);

    const now = new Date();
    const categoryAffinity = new Map<number, number>();
    const shopAffinity = new Map<string, number>();
    const interactedProductIds = new Set<string>();

    for (const interaction of interactions) {
      const signal = interactionSignalScore(
        interaction.type,
        interaction.count,
        interaction.lastInteractedAt,
        now,
      );
      interactedProductIds.add(interaction.productId);
      categoryAffinity.set(
        interaction.product.categoryId,
        (categoryAffinity.get(interaction.product.categoryId) ?? 0) + signal,
      );
      shopAffinity.set(
        interaction.product.shopId,
        (shopAffinity.get(interaction.product.shopId) ?? 0) + signal,
      );
    }

    const affinityFilter: Prisma.ProductWhereInput = {
      OR: [
        { categoryId: { in: [...categoryAffinity.keys()] } },
        { shopId: { in: [...shopAffinity.keys()] } },
      ],
    };
    const candidates = await this.prisma.product.findMany({
      where: this.publicProductWhere(query.search, {
        AND: [affinityFilter, { id: { notIn: [...interactedProductIds] } }],
      }),
      take: RecommendationsService.MAX_CANDIDATES,
      include: RECOMMENDATION_PRODUCT_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });

    const ranked = candidates
      .map((product) => ({
        product,
        score: candidateRecommendationScore({
          categoryAffinity: categoryAffinity.get(product.categoryId) ?? 0,
          shopAffinity: shopAffinity.get(product.shopId) ?? 0,
          sold: product.inventory?.sold ?? 0,
          createdAt: product.createdAt,
          now,
        }),
      }))
      .sort((left, right) => right.score - left.score || left.product.id.localeCompare(right.product.id))
      .slice(0, limit)
      .map(({ product }) => product);
    const personalizedCount = ranked.length;

    if (ranked.length < limit) {
      const fallback = await this.findTrending(limit - ranked.length, query.search, [
        ...ranked.map((product) => product.id),
      ]);
      ranked.push(...fallback);
    }

    return {
      items: ranked,
      personalized: personalizedCount > 0,
      reason: personalizedCount > 0 ? 'INTERACTIONS' as const : 'TRENDING' as const,
    };
  }

  async recordView(userId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: this.publicProductWhere(undefined, { id: productId }),
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Public product not found');
    await this.recordInteraction(this.prisma, userId, productId, InteractionType.VIEW);
    return { recorded: true };
  }

  async recordInteraction(client: DbClient, userId: string, productId: string, type: InteractionType) {
    const now = new Date();
    await client.userInteraction.upsert({
      where: { userId_productId_type: { userId, productId, type } },
      update: { count: { increment: 1 }, lastInteractedAt: now },
      create: { userId, productId, type, count: 1, lastInteractedAt: now },
    });
  }

  async resetPersonalization(userId: string) {
    const result = await this.prisma.userInteraction.deleteMany({ where: { userId } });
    return { deleted: result.count };
  }

  private async findTrending(limit: number, search?: string, excludedIds: string[] = []) {
    if (limit <= 0) return [];
    return this.prisma.product.findMany({
      where: this.publicProductWhere(search, excludedIds.length ? { id: { notIn: excludedIds } } : undefined),
      take: limit,
      include: RECOMMENDATION_PRODUCT_INCLUDE,
      orderBy: [{ inventory: { sold: 'desc' } }, { createdAt: 'desc' }, { id: 'asc' }],
    });
  }

  private publicProductWhere(search?: string, extra?: Prisma.ProductWhereInput): Prisma.ProductWhereInput {
    const base: Prisma.ProductWhereInput = {
      status: ProductStatus.ACTIVE,
      shop: { status: ShopStatus.APPROVED },
      inventory: { is: { onHand: { gt: this.prisma.inventory.fields.reserved } } },
    };
    const normalizedSearch = search?.trim();
    const searchFilter: Prisma.ProductWhereInput | undefined = normalizedSearch
      ? {
          OR: [
            { name: { contains: normalizedSearch, mode: 'insensitive' } },
            { description: { contains: normalizedSearch, mode: 'insensitive' } },
          ],
        }
      : undefined;
    return { AND: [base, ...(searchFilter ? [searchFilter] : []), ...(extra ? [extra] : [])] };
  }

  private limit(value?: number) {
    return Math.min(Math.max(value ?? 8, 1), 20);
  }
}
