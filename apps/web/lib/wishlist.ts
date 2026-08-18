export type WishlistProduct = {
  id: string;
  name: string;
  slug: string;
  price: string;
  compareAtPrice: string | null;
  images: string[];
  status: string;
  available: number;
  isPurchasable: boolean;
  shop: { id: string; name: string; slug: string; status: string };
  category: { id: number; name: string; slug: string };
};

export type WishlistItem = { id: string; createdAt: string; product: WishlistProduct };
export type WishlistPage = { items: WishlistItem[]; total: number; page: number; limit: number; totalPages: number };

export function wishlistProductIdSet(productIds: string[]) {
  return new Set(productIds);
}

export function updateWishlistMembership(current: ReadonlySet<string>, productId: string, wished: boolean) {
  const next = new Set(current);
  if (wished) next.add(productId);
  else next.delete(productId);
  return next;
}
