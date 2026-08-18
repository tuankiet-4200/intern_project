import { describe, expect, it } from '@jest/globals';
import { canAccessPath, navigationFor, resolveSurface, workspaceHref } from './navigation';

describe('role-aware navigation', () => {
  it('separates customer, vendor, and admin navigation', () => {
    expect(navigationFor('customer', 'CUSTOMER').map((item) => item.href)).toEqual([
      '/', '/cart', '/wishlist', '/orders', '/messages', '/notifications',
    ]);
    expect(navigationFor('vendor', 'VENDOR').map((item) => item.href)).toContain('/vendor/products');
    expect(navigationFor('admin', 'ADMIN').map((item) => item.href)).toContain('/admin/users');
    expect(navigationFor('admin', 'ADMIN').map((item) => item.href)).toContain('/admin/refunds');
    expect(navigationFor('admin', 'ADMIN').map((item) => item.href)).not.toContain('/cart');
    expect(navigationFor('customer', 'ADMIN').map((item) => item.href)).toEqual(['/', '/notifications']);
  });

  it('allows customer shop onboarding without exposing vendor operations', () => {
    expect(canAccessPath('/vendor/shop', 'CUSTOMER')).toBe(true);
    expect(canAccessPath('/vendor/products', 'CUSTOMER')).toBe(false);
    expect(navigationFor('vendor', 'CUSTOMER').map((item) => item.href)).toEqual(['/vendor/shop']);
  });

  it('does not reveal navigation for another protected workspace', () => {
    expect(navigationFor('admin', 'VENDOR')).toEqual([]);
    expect(navigationFor('vendor', 'ADMIN')).toEqual([]);
    expect(navigationFor('admin')).toEqual([]);
  });

  it('protects role workspaces and resolves their landing pages', () => {
    expect(canAccessPath('/products/modular-desk-lamp')).toBe(true);
    expect(canAccessPath('/shops/north-studio')).toBe(true);
    expect(canAccessPath('/admin/shops', 'VENDOR')).toBe(false);
    expect(canAccessPath('/admin/shops', 'ADMIN')).toBe(true);
    expect(canAccessPath('/vendor/orders', 'VENDOR')).toBe(true);
    expect(canAccessPath('/messages', 'CUSTOMER')).toBe(true);
    expect(canAccessPath('/checkout', 'CUSTOMER')).toBe(true);
    expect(canAccessPath('/checkout', 'ADMIN')).toBe(false);
    expect(canAccessPath('/wishlist', 'CUSTOMER')).toBe(true);
    expect(canAccessPath('/wishlist', 'ADMIN')).toBe(false);
    expect(canAccessPath('/messages')).toBe(false);
    expect(resolveSurface('/admin/coupons')).toBe('admin');
    expect(workspaceHref('ADMIN')).toBe('/admin');
    expect(workspaceHref('VENDOR')).toBe('/vendor');
  });
});
