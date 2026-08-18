import 'dotenv/config';
import { InteractionType, ProductStatus, ShopStatus, UserRole } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { PrismaService } from '../../prisma/prisma.service';
import { RecommendationsService } from './recommendations.service';

describe('RecommendationsService integration', () => {
  const prisma = new PrismaService();
  const service = new RecommendationsService(prisma);
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const emails = [
    `recommendation-owner-${nonce}@example.com`,
    `recommendation-customer-${nonce}@example.com`,
    `recommendation-other-${nonce}@example.com`,
    `recommendation-mixed-${nonce}@example.com`,
  ];
  let ownerId: string;
  let customerId: string;
  let otherId: string;
  let mixedId: string;
  let shopId: string;
  let categoryAId: number;
  let categoryBId: number;
  let viewedProductId: string;
  let affinityProductId: string;
  let otherProductId: string;
  let unavailableProductId: string;
  let categoryAExtraIds: string[];
  let categoryBExtraIds: string[];

  beforeAll(async () => {
    await prisma.$connect();
    const [owner, customer, other, mixed] = await Promise.all([
      prisma.user.create({ data: { email: emails[0], passwordHash: 'test-only', fullName: 'Recommendation Owner', role: UserRole.VENDOR } }),
      prisma.user.create({ data: { email: emails[1], passwordHash: 'test-only', fullName: 'Recommendation Customer' } }),
      prisma.user.create({ data: { email: emails[2], passwordHash: 'test-only', fullName: 'Other Customer' } }),
      prisma.user.create({ data: { email: emails[3], passwordHash: 'test-only', fullName: 'Mixed Customer' } }),
    ]);
    ownerId = owner.id;
    customerId = customer.id;
    otherId = other.id;
    mixedId = mixed.id;
    const [categoryA, categoryB] = await Promise.all([
      prisma.category.create({ data: { name: `Recommendation A ${nonce}`, slug: `recommendation-a-${nonce}` } }),
      prisma.category.create({ data: { name: `Recommendation B ${nonce}`, slug: `recommendation-b-${nonce}` } }),
    ]);
    categoryAId = categoryA.id;
    categoryBId = categoryB.id;
    const shop = await prisma.shop.create({
      data: { ownerId, name: `Recommendation Shop ${nonce}`, slug: `recommendation-shop-${nonce}`, status: ShopStatus.APPROVED },
    });
    shopId = shop.id;

    const [viewed, affinity, otherCategory, unavailable] = await Promise.all([
      createProduct('Viewed', categoryAId, 2),
      createProduct('Affinity', categoryAId, 1),
      createProduct('Other', categoryBId, 50),
      createProduct('Unavailable', categoryAId, 100, 0),
    ]);
    viewedProductId = viewed.id;
    affinityProductId = affinity.id;
    otherProductId = otherCategory.id;
    unavailableProductId = unavailable.id;
    categoryAExtraIds = (await Promise.all([
      createProduct('Affinity Extra 1', categoryAId, 0),
      createProduct('Affinity Extra 2', categoryAId, 0),
      createProduct('Affinity Extra 3', categoryAId, 0),
    ])).map((product) => product.id);
    categoryBExtraIds = (await Promise.all([
      createProduct('Other Extra 1', categoryBId, 0),
      createProduct('Other Extra 2', categoryBId, 0),
      createProduct('Other Extra 3', categoryBId, 0),
    ])).map((product) => product.id);
  });

  afterAll(async () => {
    await prisma.userInteraction.deleteMany({ where: { userId: { in: [customerId, otherId, mixedId] } } });
    await prisma.product.deleteMany({ where: { id: { in: [
      viewedProductId,
      affinityProductId,
      otherProductId,
      unavailableProductId,
      ...categoryAExtraIds,
      ...categoryBExtraIds,
    ] } } });
    await prisma.shop.deleteMany({ where: { id: shopId } });
    await prisma.category.deleteMany({ where: { id: { in: [categoryAId, categoryBId] } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
  });

  it('aggregates repeated interactions and ranks unseen products from the preferred category first', async () => {
    await service.recordView(customerId, viewedProductId);
    await service.recordView(customerId, viewedProductId);

    await expect(prisma.userInteraction.findUniqueOrThrow({
      where: { userId_productId_type: { userId: customerId, productId: viewedProductId, type: InteractionType.VIEW } },
      select: { count: true },
    })).resolves.toEqual({ count: 2 });

    const result = await service.personalizedRecommendations(customerId, { limit: 2 });
    expect(result).toEqual(expect.objectContaining({ personalized: true, reason: 'INTERACTIONS' }));
    expect(result.items[0].id).toBe(affinityProductId);
    expect(result.items.map((item) => item.id)).not.toContain(viewedProductId);
    expect(result.items.map((item) => item.id)).not.toContain(unavailableProductId);
  });

  it('falls back to visible trending products for cold-start users', async () => {
    const result = await service.personalizedRecommendations(otherId, { limit: 10 });
    expect(result).toEqual(expect.objectContaining({ personalized: false, reason: 'TRENDING' }));
    expect(result.items.map((item) => item.id)).toContain(otherProductId);
    expect(result.items.map((item) => item.id)).not.toContain(unavailableProductId);
  });

  it('mixes newly viewed and older high-intent categories instead of replacing the whole shelf', async () => {
    await service.recordInteraction(prisma, mixedId, viewedProductId, InteractionType.ADD_TO_CART);
    await service.recordView(mixedId, otherProductId);

    const result = await service.personalizedRecommendations(mixedId, { limit: 4 });
    const categoryIds = result.items.map((item) => item.categoryId);

    expect(result).toEqual(expect.objectContaining({ personalized: true, reason: 'INTERACTIONS' }));
    expect(categoryIds).toContain(categoryAId);
    expect(categoryIds).toContain(categoryBId);
    expect(categoryIds.filter((categoryId) => categoryId === categoryAId)).toHaveLength(3);
    expect(categoryIds.filter((categoryId) => categoryId === categoryBId)).toHaveLength(1);
  });

  it('resets only the requesting account personalization data', async () => {
    await service.recordView(otherId, otherProductId);
    await expect(service.resetPersonalization(customerId)).resolves.toEqual({ deleted: 1 });
    await expect(prisma.userInteraction.count({ where: { userId: customerId } })).resolves.toBe(0);
    await expect(prisma.userInteraction.count({ where: { userId: otherId } })).resolves.toBe(1);
  });

  function createProduct(label: string, categoryId: number, sold: number, onHand = 10) {
    return prisma.product.create({
      data: {
        shopId,
        categoryId,
        name: `${label} ${nonce}`,
        slug: `${label.toLowerCase()}-${nonce}`,
        price: 100000,
        status: ProductStatus.ACTIVE,
        inventory: { create: { onHand, sold } },
      },
    });
  }
});
