import { describe, expect, it } from '@jest/globals';
import { sepayFormEntries, validateSepayCheckoutUrl } from './sepay';

describe('SePay hosted checkout helpers', () => {
  it('accepts only the official hosted checkout endpoints', () => {
    expect(validateSepayCheckoutUrl('https://pay-sandbox.sepay.vn/v1/checkout/init'))
      .toBe('https://pay-sandbox.sepay.vn/v1/checkout/init');
    expect(validateSepayCheckoutUrl('https://pay.sepay.vn/v1/checkout/init'))
      .toBe('https://pay.sepay.vn/v1/checkout/init');
    expect(() => validateSepayCheckoutUrl('https://evil.example/v1/checkout/init')).toThrow();
    expect(() => validateSepayCheckoutUrl('https://pay.sepay.vn/redirect')).toThrow();
  });

  it('serializes signed fields without inventing values for optional fields', () => {
    expect(sepayFormEntries({ order_amount: 125000, merchant: 'merchant', cancel_url: undefined }))
      .toEqual([['order_amount', '125000'], ['merchant', 'merchant']]);
  });
});
