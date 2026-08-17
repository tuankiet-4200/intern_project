export function availableStock(onHand: number, reserved: number) {
  return Math.max(0, onHand - reserved);
}

export function normalizeCartQuantity(requested: number, available: number) {
  if (available <= 0) return 0;
  if (!Number.isFinite(requested)) return 1;
  return Math.min(Math.max(Math.trunc(requested), 1), available);
}

export function discountPercentage(price: string | number, compareAtPrice?: string | number | null) {
  const current = Number(price);
  const original = Number(compareAtPrice);
  if (!Number.isFinite(current) || !Number.isFinite(original) || current < 0 || original <= current) return 0;
  return Math.round(((original - current) / original) * 100);
}

export function productAttributes(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value)
    .filter((entry): entry is [string, string | number | boolean] => ['string', 'number', 'boolean'].includes(typeof entry[1]))
    .map(([key, attribute]) => ({ key, value: String(attribute) }));
}

export function productDetailPath(slug: string) {
  return `/products/${encodeURIComponent(slug)}`;
}

export function productDetailApiPath(routeParam: string) {
  let slug = routeParam;
  try {
    slug = decodeURIComponent(routeParam);
  } catch {
    // Keep malformed or already-decoded percent characters as literal slug content.
  }
  return `/products/${encodeURIComponent(slug)}`;
}
