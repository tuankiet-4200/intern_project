'use client';

import { AppShell } from '@/components/AppShell';
import { apiRequest, formatVnd, getSession, subscribeSession } from '@/lib/api';
import { setCartItemCount } from '@/lib/cart-indicator';
import { productDetailPath, shopStorefrontPath } from '@/lib/product-detail';
import { recommendationExplanation, recommendationRequest } from '@/lib/recommendations';
import { shouldResetSubmittedSearch } from '@/lib/search-filter';
import { updateWishlistMembership, wishlistProductIdSet } from '@/lib/wishlist';
import {
  Boxes,
  Check,
  Heart,
  PackageSearch,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Truck,
} from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState, useSyncExternalStore } from 'react';

type Category = {
  id: number;
  name: string;
  children: Category[];
};

type Product = {
  id: string;
  name: string;
  slug: string;
  price: string;
  images: string[];
  shop: { name: string; slug: string };
  category: { id: number; name: string };
  inventory: { onHand: number; reserved: number };
};

type RecommendationResult = {
  items: Product[];
  personalized: boolean;
  reason: 'INTERACTIONS' | 'TRENDING';
};

const EMPTY_WISHLIST_IDS = new Set<string>();

export default function Home() {
  const session = useSyncExternalStore(subscribeSession, getSession, () => null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [addingId, setAddingId] = useState('');
  const [wishlistState, setWishlistState] = useState<{ userId: string; productIds: Set<string> }>({ userId: '', productIds: new Set() });
  const [wishlistLoadingId, setWishlistLoadingId] = useState('');
  const [recommendations, setRecommendations] = useState<RecommendationResult | null>(null);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [recommendationsResetting, setRecommendationsResetting] = useState(false);
  const [recommendationMessage, setRecommendationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const wishlistProductIds = session && wishlistState.userId === session.user.id ? wishlistState.productIds : EMPTY_WISHLIST_IDS;

  const loadProducts = useCallback(async (query = '', categoryId: number | null = null) => {
    setLoading(true);
    setLoadError('');
    const parameters = new URLSearchParams({ limit: '24' });
    if (query.trim()) parameters.set('search', query.trim());
    if (categoryId) parameters.set('categoryId', String(categoryId));
    try {
      const result = await apiRequest<{ items: Product[] }>(`/products?${parameters.toString()}`);
      setProducts(result.items);
    } catch (requestError) {
      setLoadError(requestError instanceof Error ? requestError.message : 'Không thể tải danh sách sản phẩm.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    apiRequest<{ items: Product[] }>('/products?limit=24')
      .then((result) => setProducts(result.items))
      .catch((requestError: unknown) => setLoadError(requestError instanceof Error ? requestError.message : 'Không thể tải danh sách sản phẩm.'))
      .finally(() => setLoading(false));
    apiRequest<Category[]>('/categories').then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!session || session.user.role === 'ADMIN') return;
    let active = true;
    apiRequest<{ productIds: string[] }>('/wishlist/product-ids', {}, true)
      .then((result) => {
        if (active) setWishlistState({ userId: session.user.id, productIds: wishlistProductIdSet(result.productIds) });
      })
      .catch(() => {
        if (active) setWishlistState({ userId: session.user.id, productIds: new Set() });
      });
    return () => { active = false; };
  }, [session]);

  const loadRecommendations = useCallback(async () => {
    setRecommendationsLoading(true);
    const request = recommendationRequest(session?.user.role);
    try {
      const result = await apiRequest<RecommendationResult>(
        request.path,
        {},
        request.requireAuth,
      );
      setRecommendations(result);
    } catch {
      try {
        setRecommendations(await apiRequest<RecommendationResult>('/recommendations/public?limit=4'));
      } catch {
        setRecommendations(null);
      }
    } finally {
      setRecommendationsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRecommendations(), 0);
    return () => window.clearTimeout(timer);
  }, [loadRecommendations]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedSearch = searchInput.trim();
    setSearch(submittedSearch);
    void loadProducts(submittedSearch, activeCategory);
  }

  function changeSearchInput(nextInput: string) {
    setSearchInput(nextInput);
    if (shouldResetSubmittedSearch(nextInput, search)) {
      setSearch('');
      void loadProducts('', activeCategory);
    }
  }

  function chooseCategory(categoryId: number | null) {
    setActiveCategory(categoryId);
    void loadProducts(search, categoryId);
  }

  async function addToCart(product: Product) {
    setAddingId(product.id);
    setActionMessage(null);
    try {
      const nextCart = await apiRequest<{ itemCount: number }>('/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      }, true);
      setCartItemCount(nextCart.itemCount);
      setActionMessage({ type: 'success', text: `Đã thêm “${product.name}” vào giỏ hàng.` });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : '';
      setActionMessage({
        type: 'error',
        text: message.toLowerCase().includes('sign in') || message.toLowerCase().includes('session')
          ? 'Bạn cần đăng nhập để thêm sản phẩm vào giỏ hàng.'
          : message || 'Không thể thêm sản phẩm vào giỏ hàng.',
      });
    } finally {
      setAddingId('');
    }
  }

  async function toggleWishlist(product: Product) {
    if (!session) {
      setActionMessage({ type: 'error', text: 'Bạn cần đăng nhập để lưu sản phẩm yêu thích.' });
      return;
    }
    if (session.user.role === 'ADMIN') {
      setActionMessage({ type: 'error', text: 'Tài khoản Admin không có danh sách mua sắm.' });
      return;
    }
    const wished = wishlistProductIds.has(product.id);
    setWishlistLoadingId(product.id);
    setActionMessage(null);
    try {
      await apiRequest(`/wishlist/items/${product.id}`, { method: wished ? 'DELETE' : 'PUT' }, true);
      setWishlistState((current) => ({
        userId: session.user.id,
        productIds: updateWishlistMembership(current.userId === session.user.id ? current.productIds : EMPTY_WISHLIST_IDS, product.id, !wished),
      }));
      setActionMessage({ type: 'success', text: wished ? `Đã bỏ “${product.name}” khỏi yêu thích.` : `Đã lưu “${product.name}” vào yêu thích.` });
    } catch (requestError) {
      setActionMessage({ type: 'error', text: requestError instanceof Error ? requestError.message : 'Không thể cập nhật danh sách yêu thích.' });
    } finally {
      setWishlistLoadingId('');
    }
  }

  async function resetRecommendations() {
    if (!session || session.user.role === 'ADMIN') return;
    setRecommendationsResetting(true);
    setRecommendationMessage(null);
    try {
      await apiRequest('/recommendations/interactions', { method: 'DELETE' }, true);
      await loadRecommendations();
      setRecommendationMessage({ type: 'success', text: 'Đã đặt lại dữ liệu gợi ý; danh sách hiện dùng sản phẩm nổi bật.' });
    } catch (requestError) {
      setRecommendationMessage({
        type: 'error',
        text: requestError instanceof Error ? requestError.message : 'Không thể đặt lại gợi ý lúc này.',
      });
    } finally {
      setRecommendationsResetting(false);
    }
  }

  return (
    <AppShell>
      <section className="relative overflow-hidden rounded-[28px] bg-[#123b31] px-6 py-10 text-white shadow-[var(--shadow-md)] sm:px-10 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-14 lg:py-14">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-emerald-100">
            <Sparkles size={14} /> Sản phẩm chọn lọc từ nhiều nhà bán
          </span>
          <h1 className="mt-5 text-4xl font-black leading-[1.08] tracking-[-0.045em] sm:text-5xl lg:text-[58px]">
            Mua sắm gọn gàng,<br /><span className="text-emerald-300">an tâm mỗi ngày.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-emerald-50/70 sm:text-lg">
            Khám phá sản phẩm từ các cửa hàng đã được kiểm duyệt, đặt hàng thuận tiện và theo dõi mọi trạng thái tại một nơi.
          </p>
          <form className="mt-7 flex max-w-xl gap-2 rounded-2xl bg-white p-2 shadow-xl" onSubmit={submitSearch}>
            <label className="flex min-w-0 flex-1 items-center gap-2 px-2 text-[#14241f]">
              <Search className="shrink-0 text-[var(--muted)]" size={19} />
              <input
                className="h-11 min-w-0 flex-1 border-0 bg-transparent px-1 shadow-none focus:shadow-none"
                value={searchInput}
                onChange={(event) => changeSearchInput(event.target.value)}
                placeholder="Tìm sản phẩm bạn cần…"
                aria-label="Tìm kiếm sản phẩm"
              />
            </label>
            <button className="button-primary px-5" type="submit">Tìm kiếm</button>
          </form>
        </div>

        <div className="relative mt-10 hidden min-h-[330px] lg:block" aria-hidden="true">
          <div className="absolute right-5 top-0 h-72 w-72 rounded-full bg-emerald-300/15 blur-3xl" />
          <div className="absolute right-10 top-3 w-[310px] rotate-3 rounded-[28px] border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur">
            <div className="aspect-[5/3] rounded-2xl bg-gradient-to-br from-emerald-200 via-[#f0d9a8] to-[#ef8f70] p-5">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/75 text-[#123b31]"><ShoppingCart size={24} /></span>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div><p className="font-bold">Bộ sưu tập nổi bật</p><p className="mt-1 text-sm text-white/60">Từ nhà bán uy tín</p></div>
              <span className="rounded-full bg-emerald-300 px-3 py-1 text-xs font-extrabold text-[#123b31]">MỚI</span>
            </div>
          </div>
          <div className="absolute bottom-0 left-5 flex items-center gap-3 rounded-2xl border border-white/15 bg-[#214f43] p-4 shadow-xl">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-300 text-[#123b31]"><ShieldCheck size={21} /></span>
            <div><p className="text-sm font-bold">Gian hàng kiểm duyệt</p><p className="text-xs text-white/55">Minh bạch và đáng tin cậy</p></div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 py-6 sm:grid-cols-3">
        <TrustItem icon={ShieldCheck} title="Nhà bán đã xác minh" description="Chỉ hiển thị cửa hàng được duyệt" />
        <TrustItem icon={Truck} title="Theo dõi đơn rõ ràng" description="Cập nhật trạng thái trong từng bước" />
        <TrustItem icon={Store} title="Đa dạng cửa hàng" description="Một giỏ hàng, nhiều nhà bán" />
      </section>

      {recommendationsLoading || recommendations?.items.length ? (
        <section className="mt-4" aria-labelledby="recommendation-heading">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">Khám phá theo sở thích</p>
              <h2 id="recommendation-heading" className="mt-2 text-3xl font-black tracking-[-0.035em]">Gợi ý dành cho bạn</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {recommendationExplanation(Boolean(recommendations?.personalized))}
              </p>
            </div>
            {recommendations?.personalized ? (
              <button type="button" className="button-ghost self-start text-sm sm:self-auto" disabled={recommendationsResetting} onClick={() => void resetRecommendations()}>
                {recommendationsResetting ? 'Đang đặt lại…' : 'Đặt lại gợi ý'}
              </button>
            ) : null}
          </div>
          {recommendationMessage ? (
            <p className={`mt-4 rounded-xl px-4 py-3 text-sm ${recommendationMessage.type === 'success' ? 'bg-emerald-100 text-emerald-900' : 'bg-red-50 text-red-800'}`}>
              {recommendationMessage.text}
            </p>
          ) : null}
          {recommendationsLoading ? (
            <div className="mt-5 grid min-h-56 place-items-center rounded-2xl border border-dashed border-[var(--line)] bg-white/50">
              <span className="loading-spinner" aria-label="Đang tải gợi ý sản phẩm" />
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {recommendations?.items.map((product, index) => (
                <ProductCard
                  key={`recommendation-${product.id}`}
                  product={product}
                  index={index + 1}
                  adding={addingId === product.id}
                  wished={wishlistProductIds.has(product.id)}
                  wishlistLoading={wishlistLoadingId === product.id}
                  canWishlist={session?.user.role !== 'ADMIN'}
                  onAdd={() => void addToCart(product)}
                  onWishlist={() => void toggleWishlist(product)}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section id="catalog" className="mt-12 scroll-mt-28">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow">Khám phá marketplace</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.035em]">Tất cả sản phẩm</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Sản phẩm còn hàng từ các cửa hàng đang hoạt động.</p>
          </div>
          <span className="text-sm font-semibold text-[var(--muted)]">{loading ? 'Đang cập nhật…' : `${products.length} sản phẩm`}</span>
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-2" aria-label="Lọc theo danh mục">
          <CategoryButton active={activeCategory === null} label="Tất cả" onClick={() => chooseCategory(null)} />
          {categories.flatMap((category) => [category, ...(category.children ?? [])]).map((category) => (
            <CategoryButton key={category.id} active={activeCategory === category.id} label={category.name} onClick={() => chooseCategory(category.id)} />
          ))}
        </div>

        {actionMessage ? (
          <div className={`mt-4 flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm ${actionMessage.type === 'success' ? 'bg-emerald-100 text-emerald-900' : 'bg-red-50 text-red-800'}`}>
            <span className="flex items-center gap-2">{actionMessage.type === 'success' ? <Check size={17} /> : null}{actionMessage.text}</span>
            {actionMessage.type === 'error' ? <Link href="/login" className="shrink-0 font-bold underline">Đăng nhập</Link> : null}
          </div>
        ) : null}

        {loading ? (
          <div className="grid min-h-72 place-items-center"><div className="text-center"><span className="loading-spinner mx-auto" /><p className="mt-3 text-sm text-[var(--muted)]">Đang tải sản phẩm…</p></div></div>
        ) : null}
        {!loading && loadError ? (
          <div className="surface-card mt-5 p-8 text-center"><PackageSearch className="mx-auto text-red-500" size={30} /><h3 className="mt-3 font-bold">Chưa thể tải sản phẩm</h3><p className="mt-1 text-sm text-[var(--muted)]">{loadError}</p><button className="button-ghost mt-4" onClick={() => void loadProducts(search, activeCategory)}>Thử lại</button></div>
        ) : null}
        {!loading && !loadError && products.length === 0 ? (
          <div className="surface-card mt-5 p-10 text-center"><PackageSearch className="mx-auto text-[var(--accent)]" size={34} /><h3 className="mt-4 text-lg font-bold">Chưa tìm thấy sản phẩm phù hợp</h3><p className="mt-1 text-sm text-[var(--muted)]">Hãy thử từ khóa hoặc danh mục khác.</p><button className="button-soft mt-4" onClick={() => { setSearchInput(''); setSearch(''); setActiveCategory(null); void loadProducts('', null); }}>Xóa bộ lọc</button></div>
        ) : null}

        {!loading && !loadError && products.length > 0 ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                index={index}
                adding={addingId === product.id}
                wished={wishlistProductIds.has(product.id)}
                wishlistLoading={wishlistLoadingId === product.id}
                canWishlist={session?.user.role !== 'ADMIN'}
                onAdd={() => void addToCart(product)}
                onWishlist={() => void toggleWishlist(product)}
              />
            ))}
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}

function ProductCard({
  product,
  index,
  adding,
  wished,
  wishlistLoading,
  canWishlist,
  onAdd,
  onWishlist,
}: {
  product: Product;
  index: number;
  adding: boolean;
  wished: boolean;
  wishlistLoading: boolean;
  canWishlist: boolean;
  onAdd: () => void;
  onWishlist: () => void;
}) {
  const available = Math.max(0, product.inventory.onHand - product.inventory.reserved);
  const gradients = [
    'from-[#d9eee5] via-[#eef5dc] to-[#f1d4ad]',
    'from-[#e3e6f6] via-[#dbeee9] to-[#c8d8ea]',
    'from-[#f5dfd2] via-[#f0e8cd] to-[#d9e9df]',
    'from-[#dceada] via-[#d7e4ee] to-[#ead8e9]',
  ];
  const image = product.images?.[0];

  return (
    <article className="group overflow-hidden rounded-2xl border border-[var(--line)] bg-white transition duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-md)]">
      <div className={`relative aspect-[4/3] overflow-hidden bg-gradient-to-br ${gradients[index % gradients.length]} bg-cover bg-center`} style={image ? { backgroundImage: `url(${JSON.stringify(image)})` } : undefined}>
        <Link href={productDetailPath(product.slug)} aria-label={`Xem chi tiết ${product.name}`} className="absolute inset-0 z-10" />
        <span className="pointer-events-none absolute left-4 top-4 z-20 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-bold text-[#315248] shadow-sm backdrop-blur">{product.category.name}</span>
        {!image ? (
          <span className="absolute inset-0 grid place-items-center text-[#244b40]/20"><PackageSearch size={68} strokeWidth={1.2} /></span>
        ) : null}
        <span className="pointer-events-none absolute bottom-4 right-4 z-20 rounded-lg bg-[#143c32]/90 px-2 py-1 text-[11px] font-bold text-white">Còn {available}</span>
        {canWishlist ? <button type="button" className={`absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border shadow-md backdrop-blur transition ${wished ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-white/70 bg-white/90 text-[#315248] hover:text-rose-600'}`} onClick={onWishlist} disabled={wishlistLoading} aria-label={wished ? `Bỏ ${product.name} khỏi yêu thích` : `Thêm ${product.name} vào yêu thích`} aria-pressed={wished}>{wishlistLoading ? <span className="loading-spinner !h-4 !w-4 !border-2" /> : <Heart size={19} fill={wished ? 'currentColor' : 'none'} />}</button> : null}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[var(--muted)]"><Link href={shopStorefrontPath(product.shop.slug)} className="relative z-20 flex min-w-0 items-center gap-1.5 transition hover:text-[var(--accent)]"><Store className="shrink-0" size={13} /><span className="truncate">{product.shop.name}</span></Link><p className="flex shrink-0 items-center gap-1 text-emerald-700"><Boxes size={13} /> Kho: {available}</p></div>
        <h3 className="mt-2 line-clamp-2 min-h-12 text-base font-extrabold leading-6"><Link href={productDetailPath(product.slug)} className="transition hover:text-[var(--accent)]">{product.name}</Link></h3>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
          <span className="text-base font-black text-[var(--accent-strong)]">{formatVnd(product.price)}</span>
          <button className="icon-button !border-[var(--accent)] !bg-[var(--accent)] !text-white disabled:opacity-50" disabled={adding || available < 1} onClick={onAdd} aria-label={`Thêm ${product.name} vào giỏ`}>
            {adding ? <span className="loading-spinner !h-5 !w-5 !border-2 !border-white/40 !border-t-white" /> : <ShoppingCart size={18} />}
          </button>
        </div>
      </div>
    </article>
  );
}

function CategoryButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition ${active ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--line)] bg-white text-[var(--muted)] hover:border-[#adc8bc] hover:text-[var(--foreground)]'}`}>{label}</button>;
}

function TrustItem({ icon: Icon, title, description }: { icon: typeof ShieldCheck; title: string; description: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Icon size={19} /></span>
      <div><p className="text-sm font-extrabold">{title}</p><p className="mt-0.5 text-xs text-[var(--muted)]">{description}</p></div>
    </div>
  );
}
