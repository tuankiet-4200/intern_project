import { describe, expect, it, jest } from '@jest/globals';
import {
  getRecommendationInteractionVersion,
  notifyRecommendationInteractionRecorded,
  subscribeRecommendationInteractions,
} from './recommendation-refresh';

describe('recommendation refresh signal', () => {
  it('notifies active Home subscribers after an interaction is persisted', () => {
    const listener = jest.fn();
    const previousVersion = getRecommendationInteractionVersion();
    const unsubscribe = subscribeRecommendationInteractions(listener);

    notifyRecommendationInteractionRecorded();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getRecommendationInteractionVersion()).toBe(previousVersion + 1);
    unsubscribe();
    notifyRecommendationInteractionRecorded();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
