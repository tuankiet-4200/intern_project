let itemCount = 0;
const listeners = new Set<() => void>();

export function getWishlistItemCount() {
  return itemCount;
}

export function subscribeWishlistItemCount(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setWishlistItemCount(nextItemCount: number) {
  const normalized = Number.isFinite(nextItemCount)
    ? Math.max(0, Math.floor(nextItemCount))
    : 0;
  if (normalized === itemCount) return;
  itemCount = normalized;
  for (const listener of listeners) listener();
}

export function resetWishlistItemCount() {
  setWishlistItemCount(0);
}

export function formatWishlistBadgeCount(count: number) {
  return count > 99 ? '99+' : String(count);
}
