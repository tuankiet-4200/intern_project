import {
  DEMO_CATEGORY_FIXTURES,
  DEMO_PRODUCT_FIXTURES,
  DEMO_VENDOR_FIXTURES,
} from './demo-catalog-data';
import { describe, expect, it } from '@jest/globals';

describe('demo catalog fixture', () => {
  it('contains exactly 20 unique CellphoneS products in every category', () => {
    expect(DEMO_PRODUCT_FIXTURES).toHaveLength(DEMO_CATEGORY_FIXTURES.length * 20);
    expect(new Set(DEMO_PRODUCT_FIXTURES.map((product) => product.slug)).size).toBe(DEMO_PRODUCT_FIXTURES.length);

    for (const category of DEMO_CATEGORY_FIXTURES) {
      expect(DEMO_PRODUCT_FIXTURES.filter((product) => product.categorySlug === category.slug)).toHaveLength(20);
    }
  });

  it('distributes five products from every category to each demo shop', () => {
    for (const vendor of DEMO_VENDOR_FIXTURES) {
      const vendorProducts = DEMO_PRODUCT_FIXTURES.filter((product) => product.shopSlug === vendor.shopSlug);
      expect(vendorProducts).toHaveLength(15);
      for (const category of DEMO_CATEGORY_FIXTURES) {
        expect(vendorProducts.filter((product) => product.categorySlug === category.slug)).toHaveLength(5);
      }
    }
  });

  it('keeps source, image and merchandising data valid', () => {
    for (const product of DEMO_PRODUCT_FIXTURES) {
      expect(product.sourceUrl).toMatch(/^https:\/\/cellphones\.com\.vn\//);
      expect(product.imageUrl).toMatch(/^https:\/\/cdn2\.cellphones\.com\.vn\//);
      expect(product.price).toBeGreaterThan(0);
      if (product.compareAtPrice !== undefined) expect(product.compareAtPrice).toBeGreaterThan(product.price);
    }
  });
});
