export type RecommendationInteractionType = 'VIEW' | 'WISHLIST' | 'ADD_TO_CART' | 'PURCHASE';

const INTERACTION_WEIGHT: Record<RecommendationInteractionType, number> = {
  VIEW: 1,
  WISHLIST: 4,
  ADD_TO_CART: 5,
  PURCHASE: 8,
};

const HALF_LIFE_DAYS = 30;
const MILLISECONDS_PER_DAY = 86_400_000;

export function interactionSignalScore(
  type: RecommendationInteractionType,
  count: number,
  lastInteractedAt: Date,
  now = new Date(),
) {
  const ageDays = Math.max(0, (now.getTime() - lastInteractedAt.getTime()) / MILLISECONDS_PER_DAY);
  const recency = 2 ** (-ageDays / HALF_LIFE_DAYS);
  const repeatBoost = Math.min(2, 1 + Math.log1p(Math.max(0, count - 1)) * 0.35);
  return INTERACTION_WEIGHT[type] * recency * repeatBoost;
}

export function candidateRecommendationScore(input: {
  categoryAffinity: number;
  shopAffinity: number;
  sold: number;
  createdAt: Date;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const ageDays = Math.max(0, (now.getTime() - input.createdAt.getTime()) / MILLISECONDS_PER_DAY);
  const freshness = 1 / (1 + ageDays / 90);
  return input.categoryAffinity * 3
    + input.shopAffinity * 1.5
    + Math.log1p(Math.max(0, input.sold)) * 0.5
    + freshness * 0.25;
}
