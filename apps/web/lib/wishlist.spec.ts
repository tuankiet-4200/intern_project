import { describe, expect, it } from '@jest/globals';
import { updateWishlistMembership, wishlistProductIdSet } from './wishlist';

describe('wishlist UI state', () => {
  it('deduplicates product ids received from the API', () => {
    expect([...wishlistProductIdSet(['a', 'a', 'b'])]).toEqual(['a', 'b']);
  });

  it('updates membership immutably for add and remove responses', () => {
    const current = new Set(['a']);
    const added = updateWishlistMembership(current, 'b', true);
    const removed = updateWishlistMembership(added, 'a', false);
    expect([...current]).toEqual(['a']);
    expect([...added]).toEqual(['a', 'b']);
    expect([...removed]).toEqual(['b']);
  });
});
