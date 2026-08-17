import { describe, expect, it, jest } from '@jest/globals';
import { submitAndReset } from './form-submission';

describe('submitAndReset', () => {
  it('uses the captured form after an asynchronous submit succeeds', async () => {
    const reset = jest.fn();
    await expect(submitAndReset({ reset }, async () => 'created')).resolves.toBe('created');
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('keeps form values when submission fails', async () => {
    const reset = jest.fn();
    await expect(submitAndReset({ reset }, async () => { throw new Error('API failed'); })).rejects.toThrow('API failed');
    expect(reset).not.toHaveBeenCalled();
  });
});
