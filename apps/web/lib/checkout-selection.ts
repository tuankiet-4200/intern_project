export type SelectableCartItem = { id: string; isValid: boolean };

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function reconcileCartSelection(
  current: ReadonlySet<string> | null,
  items: SelectableCartItem[],
) {
  const selectableIds = new Set(items.filter((item) => item.isValid).map((item) => item.id));
  if (current === null) return selectableIds;
  return new Set([...current].filter((itemId) => selectableIds.has(itemId)));
}

export function toggleCartSelection(current: ReadonlySet<string>, itemId: string, selected: boolean) {
  const next = new Set(current);
  if (selected) next.add(itemId);
  else next.delete(itemId);
  return next;
}

export function checkoutPath(cartItemIds: Iterable<string>) {
  const normalized = [...new Set(cartItemIds)].sort();
  const query = new URLSearchParams({ items: normalized.join(',') });
  return `/checkout?${query.toString()}`;
}

export function parseCheckoutItemIds(value: string | null) {
  if (!value) return [];
  const ids = [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
  if (ids.length > 99 || ids.some((id) => !UUID_V4.test(id))) return [];
  return ids;
}
