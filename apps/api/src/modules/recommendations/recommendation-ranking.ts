export type RecommendationInteractionType = 'VIEW' | 'WISHLIST' | 'ADD_TO_CART' | 'PURCHASE';

const INTERACTION_WEIGHT: Record<RecommendationInteractionType, number> = {
  VIEW: 1,
  WISHLIST: 4,
  ADD_TO_CART: 5,
  PURCHASE: 8,
};

const HALF_LIFE_DAYS = 30;
const MILLISECONDS_PER_DAY = 86_400_000;
const MAX_CATEGORY_SHARE = 0.75;

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

export function diversifyRecommendationCandidates<T extends {
  product: { id: string; categoryId: number };
  score: number;
}>(
  rankedCandidates: T[],
  categoryAffinities: ReadonlyMap<number, number>,
  limit: number,
) {
  const boundedLimit = Math.max(0, Math.floor(limit));
  if (boundedLimit === 0) return [];

  const preferredCategories = [...categoryAffinities.entries()]
    .filter(([categoryId]) => rankedCandidates.some((candidate) => candidate.product.categoryId === categoryId))
    .sort((left, right) => right[1] - left[1] || left[0] - right[0]);

  if (preferredCategories.length <= 1) return rankedCandidates.slice(0, boundedLimit);

  const selected: T[] = [];
  const selectedIds = new Set<string>();
  const categoryCounts = new Map<number, number>();
  const add = (candidate: T) => {
    selected.push(candidate);
    selectedIds.add(candidate.product.id);
    categoryCounts.set(candidate.product.categoryId, (categoryCounts.get(candidate.product.categoryId) ?? 0) + 1);
  };

  for (const [categoryId] of preferredCategories) {
    if (selected.length >= boundedLimit) break;
    const bestInCategory = rankedCandidates.find((candidate) => candidate.product.categoryId === categoryId);
    if (bestInCategory) add(bestInCategory);
  }

  const maxPerCategory = Math.max(1, Math.ceil(boundedLimit * MAX_CATEGORY_SHARE));
  for (const candidate of rankedCandidates) {
    if (selected.length >= boundedLimit) break;
    if (selectedIds.has(candidate.product.id)) continue;
    if ((categoryCounts.get(candidate.product.categoryId) ?? 0) >= maxPerCategory) continue;
    add(candidate);
  }

  // A narrow catalog should still fill the shelf even when the diversity cap cannot be met.
  for (const candidate of rankedCandidates) {
    if (selected.length >= boundedLimit) break;
    if (!selectedIds.has(candidate.product.id)) add(candidate);
  }

  return selected;
}
