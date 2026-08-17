let itemCount = 0;
const listeners = new Set<() => void>();

export function getCartItemCount() {
  return itemCount;
}

export function subscribeCartItemCount(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setCartItemCount(nextItemCount: number) {
  const normalized = Number.isFinite(nextItemCount)
    ? Math.max(0, Math.floor(nextItemCount))
    : 0;
  if (normalized === itemCount) return;
  itemCount = normalized;
  for (const listener of listeners) listener();
}

export function resetCartItemCount() {
  setCartItemCount(0);
}

export function formatCartBadgeCount(count: number) {
  return count > 99 ? '99+' : String(count);
}
