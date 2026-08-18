import { describe, expect, it } from '@jest/globals';
import { recommendationExplanation, recommendationRequest } from './recommendations';

describe('recommendation helpers', () => {
  it('uses authenticated personalization only for shopping roles', () => {
    expect(recommendationRequest('CUSTOMER')).toEqual({ path: '/recommendations?limit=4', requireAuth: true });
    expect(recommendationRequest('VENDOR', 8)).toEqual({ path: '/recommendations?limit=8', requireAuth: true });
  });

  it('keeps anonymous and admin browsing on the public cold-start endpoint', () => {
    expect(recommendationRequest()).toEqual({ path: '/recommendations/public?limit=4', requireAuth: false });
    expect(recommendationRequest('ADMIN')).toEqual({ path: '/recommendations/public?limit=4', requireAuth: false });
  });

  it('explains whether the shelf is personalized', () => {
    expect(recommendationExplanation(true)).toContain('Dựa trên');
    expect(recommendationExplanation(false)).toContain('nổi bật');
  });
});
