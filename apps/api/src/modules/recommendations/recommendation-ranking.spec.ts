import { describe, expect, it } from '@jest/globals';
import {
  candidateRecommendationScore,
  diversifyRecommendationCandidates,
  interactionSignalScore,
} from './recommendation-ranking';

describe('recommendation ranking', () => {
  const now = new Date('2026-08-18T12:00:00.000Z');

  it('weights stronger commerce intent above a product view', () => {
    const viewed = interactionSignalScore('VIEW', 1, now, now);
    expect(interactionSignalScore('WISHLIST', 1, now, now)).toBeGreaterThan(viewed);
    expect(interactionSignalScore('ADD_TO_CART', 1, now, now)).toBeGreaterThan(viewed);
    expect(interactionSignalScore('PURCHASE', 1, now, now)).toBeGreaterThan(viewed);
  });

  it('halves signal strength after the configured 30 day half-life', () => {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
    expect(interactionSignalScore('ADD_TO_CART', 1, thirtyDaysAgo, now))
      .toBeCloseTo(interactionSignalScore('ADD_TO_CART', 1, now, now) / 2, 8);
  });

  it('caps repeated-event influence so refresh spam cannot dominate ranking', () => {
    const first = interactionSignalScore('VIEW', 1, now, now);
    expect(interactionSignalScore('VIEW', 1_000_000, now, now)).toBeLessThanOrEqual(first * 2);
  });

  it('prioritizes category affinity over popularity-only candidates', () => {
    const affinity = candidateRecommendationScore({ categoryAffinity: 4, shopAffinity: 0, sold: 0, createdAt: now, now });
    const popular = candidateRecommendationScore({ categoryAffinity: 0, shopAffinity: 0, sold: 100, createdAt: now, now });
    expect(affinity).toBeGreaterThan(popular);
  });

  it('keeps an older preferred category when a newly viewed category enters the shelf', () => {
    const ranked = [
      candidate('laptop-1', 1, 20),
      candidate('laptop-2', 1, 19),
      candidate('laptop-3', 1, 18),
      candidate('laptop-4', 1, 17),
      candidate('phone-1', 2, 5),
      candidate('phone-2', 2, 4),
    ];

    const result = diversifyRecommendationCandidates(ranked, new Map([[1, 5], [2, 1]]), 4);

    expect(result.map(({ product }) => product.id)).toEqual([
      'laptop-1',
      'phone-1',
      'laptop-2',
      'laptop-3',
    ]);
  });

  it('fills a narrow single-category catalog without introducing empty slots', () => {
    const ranked = [candidate('laptop-1', 1, 20), candidate('laptop-2', 1, 19)];
    expect(diversifyRecommendationCandidates(ranked, new Map([[1, 5], [2, 1]]), 4))
      .toHaveLength(2);
  });

  function candidate(id: string, categoryId: number, score: number) {
    return { product: { id, categoryId }, score };
  }
});
