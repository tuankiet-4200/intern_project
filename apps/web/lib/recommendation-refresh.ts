type RecommendationRefreshListener = () => void;

let interactionVersion = 0;
const listeners = new Set<RecommendationRefreshListener>();

export function getRecommendationInteractionVersion() {
  return interactionVersion;
}

export function subscribeRecommendationInteractions(listener: RecommendationRefreshListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyRecommendationInteractionRecorded() {
  interactionVersion += 1;
  for (const listener of listeners) listener();
}
