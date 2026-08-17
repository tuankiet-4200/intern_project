import { describe, expect, it } from '@jest/globals';
import {
  availableStock,
  discountPercentage,
  normalizeCartQuantity,
  productAttributes,
  productDetailApiPath,
  productDetailPath,
} from './product-detail';

describe('product detail helpers', () => {
  it('derives non-negative available stock', () => {
    expect(availableStock(12, 5)).toBe(7);
    expect(availableStock(2, 4)).toBe(0);
  });

  it('keeps requested quantity inside the available range', () => {
    expect(normalizeCartQuantity(-4, 8)).toBe(1);
    expect(normalizeCartQuantity(3.8, 8)).toBe(3);
    expect(normalizeCartQuantity(20, 8)).toBe(8);
    expect(normalizeCartQuantity(1, 0)).toBe(0);
  });

  it('only reports a valid compare-at discount', () => {
    expect(discountPercentage('75000', '100000')).toBe(25);
    expect(discountPercentage('100000', '90000')).toBe(0);
    expect(discountPercentage('100000', null)).toBe(0);
  });

  it('exposes scalar product attributes and ignores nested values', () => {
    expect(productAttributes({ color: 'Xanh', weight: 2, featured: true, nested: { size: 1 } })).toEqual([
      { key: 'color', value: 'Xanh' },
      { key: 'weight', value: '2' },
      { key: 'featured', value: 'true' },
    ]);
    expect(productAttributes(['invalid'])).toEqual([]);
  });

  it('keeps product slugs with spaces and Unicode single-encoded across links and API requests', () => {
    const slug = 'MacBook Pro 2024 – Like New';
    const encoded = 'MacBook%20Pro%202024%20%E2%80%93%20Like%20New';

    expect(productDetailPath(slug)).toBe(`/products/${encoded}`);
    expect(productDetailApiPath(encoded)).toBe(`/products/${encoded}`);
    expect(productDetailApiPath(slug)).toBe(`/products/${encoded}`);
    expect(productDetailApiPath('modular-desk-lamp')).toBe('/products/modular-desk-lamp');
  });

  it('treats malformed percent characters as literal slug content', () => {
    expect(productDetailApiPath('save-50%-today')).toBe('/products/save-50%25-today');
  });
});
