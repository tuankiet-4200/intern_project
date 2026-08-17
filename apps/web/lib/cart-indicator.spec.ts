import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { formatCartBadgeCount, getCartItemCount, resetCartItemCount, setCartItemCount, subscribeCartItemCount } from './cart-indicator';

describe('cart indicator store', () => {
  beforeEach(() => resetCartItemCount());

  it('normalizes the count and notifies subscribers only when it changes', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeCartItemCount(listener);
    setCartItemCount(3.8);
    setCartItemCount(3);
    expect(getCartItemCount()).toBe(3);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('renders large counts compactly', () => {
    expect(formatCartBadgeCount(8)).toBe('8');
    expect(formatCartBadgeCount(120)).toBe('99+');
  });
});
