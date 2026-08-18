import { describe, expect, it } from '@jest/globals';
import {
  checkoutPath,
  parseCheckoutItemIds,
  reconcileCartSelection,
  toggleCartSelection,
} from './checkout-selection';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

describe('checkout selection helpers', () => {
  it('initially selects only valid cart items and preserves explicit choices after refresh', () => {
    const items = [{ id: A, isValid: true }, { id: B, isValid: false }, { id: C, isValid: true }];
    expect([...reconcileCartSelection(null, items)]).toEqual([A, C]);
    expect([...reconcileCartSelection(new Set([A, B]), items)]).toEqual([A]);
  });

  it('updates selection immutably', () => {
    const current = new Set([A]);
    expect([...toggleCartSelection(current, C, true)]).toEqual([A, C]);
    expect([...toggleCartSelection(current, A, false)]).toEqual([]);
    expect([...current]).toEqual([A]);
  });

  it('round-trips a deterministic selection and rejects malformed input', () => {
    const path = checkoutPath([C, A, C]);
    expect(path).toBe(`/checkout?items=${A}%2C${C}`);
    expect(parseCheckoutItemIds(new URL(`http://localhost${path}`).searchParams.get('items'))).toEqual([A, C]);
    expect(parseCheckoutItemIds('not-a-uuid')).toEqual([]);
  });
});
