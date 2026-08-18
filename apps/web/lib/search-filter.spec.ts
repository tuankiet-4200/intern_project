import { describe, expect, it } from '@jest/globals';
import { shouldResetSubmittedSearch } from './search-filter';

describe('submitted search reset', () => {
  it('resets an applied search as soon as the input is cleared', () => {
    expect(shouldResetSubmittedSearch('', 'mac')).toBe(true);
    expect(shouldResetSubmittedSearch('   ', 'mac')).toBe(true);
  });

  it('does not reload while typing or repeatedly clearing an empty filter', () => {
    expect(shouldResetSubmittedSearch('macbook', 'mac')).toBe(false);
    expect(shouldResetSubmittedSearch('', '')).toBe(false);
  });
});
