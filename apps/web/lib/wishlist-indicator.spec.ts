import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  formatWishlistBadgeCount,
  getWishlistItemCount,
  resetWishlistItemCount,
  setWishlistItemCount,
  subscribeWishlistItemCount,
} from './wishlist-indicator';

describe('wishlist indicator store', () => {
  beforeEach(() => resetWishlistItemCount());

  it('normalizes unique-item count and notifies only when it changes', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeWishlistItemCount(listener);
    setWishlistItemCount(4.8);
    setWishlistItemCount(4);
    expect(getWishlistItemCount()).toBe(4);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('renders large counts compactly', () => {
    expect(formatWishlistBadgeCount(8)).toBe('8');
    expect(formatWishlistBadgeCount(120)).toBe('99+');
  });
});
