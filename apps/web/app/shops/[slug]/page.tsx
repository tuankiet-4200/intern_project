'use client';

import { AppShell } from '@/components/AppShell';
import { apiRequest, formatVnd } from '@/lib/api';
import {
  availableStock,
  discountPercentage,
  productDetailPath,
  shopStorefrontApiPath,
} from '@/lib/product-detail';
import { shouldResetSubmittedSearch } from '@/lib/search-filter';
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  PackageSearch,
  Search,
  ShieldCheck,
  Star,
  Store,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';

type Category = { id: number; name: string; slug: string };
type Product = {
  id: string;
  name: string;
  slug: string;
  price: string;
  compareAtPrice: string | null;
  images: string[];
  shop: { id: string; name: string; slug: string };
  category: Category;
  inventory: { onHand: number; reserved: number };
};
type Storefront = {
  shop: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    logoUrl: string | null;
    rating: string;
    createdAt: string;
  };
  categories: Category[];
  products: { items: Product[]; total: number; page: number; limit: number; totalPages: number };
};

export default function ShopStorefrontPage() {
  const params = useParams<{ slug: string }>();
  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (nextSearch = '', nextCategoryId: number | null = null, nextPage = 1) => {
    setLoading(true);
    setError('');
    const query = new URLSearchParams({ page: String(nextPage), limit: '20' });
    if (nextSearch.trim()) query.set('search', nextSearch.trim());
    if (nextCategoryId) query.set('categoryId', String(nextCategoryId));
    try {
      setStorefront(await apiRequest<Storefront>(`${shopStorefrontApiPath(params.slug)}?${query.toString()}`));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể tải gian hàng.');
    } finally {
      setLoading(false);
    }
  }, [params.slug]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextSearch = searchInput.trim();
    setSearch(nextSearch);
    setPage(1);
    void load(nextSearch, categoryId, 1);
  }

  function changeSearchInput(value: string) {
    setSearchInput(value);
    if (shouldResetSubmittedSearch(value, search)) {
      setSearch('');
      setPage(1);
      void load('', categoryId, 1);
    }
  }

  function chooseCategory(nextCategoryId: number | null) {
    setCategoryId(nextCategoryId);
    setPage(1);
    void load(search, nextCategoryId, 1);
  }

  function changePage(nextPage: number) {
    setPage(nextPage);
    void load(search, categoryId, nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (loading && !storefront) {
    return <AppShell><div className="grid min-h-[60vh] place-items-center"><div className="text-center"><span className="loading-spinner mx-auto" /><p className="mt-3 text-sm text-[var(--muted)]">Đang mở gian hàng…</p></div></div></AppShell>;
  }

  if (error && !storefront) {
    return <AppShell><section className="surface-card mx-auto max-w-2xl p-9 text-center"><PackageSearch className="mx-auto text-red-500" size={36} /><h1 className="mt-4 text-2xl font-black">Không tìm thấy gian hàng</h1><p className="mt-2 text-sm text-[var(--muted)]">{error}</p><Link href="/" className="button-primary mt-6">Về marketplace</Link></section></AppShell>;
  }

  if (!storefront) return null;

  return (
    <AppShell>
      <section className="relative overflow-hidden rounded-[28px] bg-[#123b31] px-6 py-8 text-white shadow-[var(--shadow-md)] sm:px-9 sm:py-10">
        <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-emerald-300/15 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-300 bg-cover bg-center text-[#123b31] shadow-lg" style={storefront.shop.logoUrl ? { backgroundImage: `url(${JSON.stringify(storefront.shop.logoUrl)})` } : undefined}>
              {!storefront.shop.logoUrl ? <Store size={30} /> : null}
            </span>
            <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200/70">Gian hàng đã kiểm duyệt</p><h1 className="mt-2 truncate text-3xl font-black tracking-[-0.035em] sm:text-4xl">{storefront.shop.name}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/70">{storefront.shop.description || 'Nhà bán đang hoạt động trên Intern Market.'}</p></div>
          </div>
          <div className="flex shrink-0 gap-3"><ShopMetric icon={ShieldCheck} label="Trạng thái" value="Đã duyệt" /><ShopMetric icon={Star} label="Đánh giá" value={`${Number(storefront.shop.rating).toFixed(1)}/5`} /></div>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div><p className="eyebrow">Danh mục của shop</p><h2 className="mt-2 text-3xl font-black tracking-[-0.035em]">Sản phẩm đang bán</h2><p className="mt-2 text-sm text-[var(--muted)]">Chỉ hiển thị sản phẩm đang hoạt động và còn hàng.</p></div>
          <form className="flex w-full max-w-xl gap-2 rounded-2xl border border-[var(--line)] bg-white p-2 shadow-[var(--shadow-sm)]" onSubmit={submitSearch}>
            <label className="flex min-w-0 flex-1 items-center gap-2 px-2"><Search size={18} className="text-[var(--muted)]" /><input className="h-10 min-w-0 flex-1 border-0 bg-transparent px-1 shadow-none focus:shadow-none" value={searchInput} onChange={(event) => changeSearchInput(event.target.value)} placeholder="Tìm trong gian hàng…" aria-label="Tìm sản phẩm trong gian hàng" /></label>
            <button type="submit" className="button-primary !min-h-10 px-5">Tìm</button>
          </form>
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-2" aria-label="Lọc danh mục của gian hàng">
          <FilterButton active={categoryId === null} label="Tất cả" onClick={() => chooseCategory(null)} />
          {storefront.categories.map((category) => <FilterButton key={category.id} active={categoryId === category.id} label={category.name} onClick={() => chooseCategory(category.id)} />)}
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-[var(--muted)]"><span>{storefront.products.total} sản phẩm phù hợp</span>{loading ? <span>Đang cập nhật…</span> : null}</div>
        {error ? <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}

        {!loading && storefront.products.items.length === 0 ? (
          <div className="surface-card mt-5 p-10 text-center"><PackageSearch className="mx-auto text-[var(--accent)]" size={36} /><h3 className="mt-4 text-lg font-extrabold">Chưa có sản phẩm phù hợp</h3><p className="mt-1 text-sm text-[var(--muted)]">Thử xóa từ khóa hoặc chọn danh mục khác.</p></div>
        ) : (
          <div className={`mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${loading ? 'opacity-60' : ''}`}>
            {storefront.products.items.map((product) => <StoreProductCard key={product.id} product={product} />)}
          </div>
        )}

        {storefront.products.totalPages > 1 ? (
          <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Phân trang sản phẩm"><button type="button" className="button-ghost" disabled={page <= 1 || loading} onClick={() => changePage(page - 1)}><ChevronLeft size={17} /> Trang trước</button><span className="text-sm font-bold">Trang {page}/{storefront.products.totalPages}</span><button type="button" className="button-ghost" disabled={page >= storefront.products.totalPages || loading} onClick={() => changePage(page + 1)}>Trang sau <ChevronRight size={17} /></button></nav>
        ) : null}
      </section>
    </AppShell>
  );
}

function ShopMetric({ icon: Icon, label, value }: { icon: typeof Star; label: string; value: string }) {
  return <div className="min-w-28 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur"><Icon size={17} className="text-emerald-300" /><p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-white/55">{label}</p><p className="mt-1 text-sm font-extrabold">{value}</p></div>;
}

function FilterButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition ${active ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--line)] bg-white text-[var(--muted)] hover:border-[#adc8bc] hover:text-[var(--foreground)]'}`} onClick={onClick}>{label}</button>;
}

function StoreProductCard({ product }: { product: Product }) {
  const available = availableStock(product.inventory.onHand, product.inventory.reserved);
  const discount = discountPercentage(product.price, product.compareAtPrice);
  const image = product.images[0];
  return <article className="group overflow-hidden rounded-2xl border border-[var(--line)] bg-white transition hover:-translate-y-1 hover:shadow-[var(--shadow-md)]"><Link href={productDetailPath(product.slug)} className="relative block aspect-[4/3] overflow-hidden bg-gradient-to-br from-[#d9eee5] via-[#eef5dc] to-[#f1d4ad] bg-cover bg-center" style={image ? { backgroundImage: `url(${JSON.stringify(image)})` } : undefined}>{!image ? <span className="absolute inset-0 grid place-items-center text-[#244b40]/20"><PackageSearch size={62} /></span> : null}<span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-[#315248] shadow-sm">{product.category.name}</span><span className="absolute bottom-3 right-3 rounded-lg bg-[#143c32]/90 px-2 py-1 text-[11px] font-bold text-white">Còn {available}</span></Link><div className="p-4"><p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)]"><Boxes size={13} /> Kho khả dụng: {available}</p><h3 className="mt-2 line-clamp-2 min-h-12 font-extrabold leading-6"><Link href={productDetailPath(product.slug)} className="transition hover:text-[var(--accent)]">{product.name}</Link></h3><div className="mt-4 border-t border-[var(--line)] pt-4"><div className="flex flex-wrap items-baseline gap-2"><span className="font-black text-[var(--accent-strong)]">{formatVnd(product.price)}</span>{discount > 0 && product.compareAtPrice ? <span className="text-xs text-[var(--muted)] line-through">{formatVnd(product.compareAtPrice)}</span> : null}</div>{discount > 0 ? <p className="mt-1 text-xs font-bold text-[#e8573d]">Tiết kiệm {discount}%</p> : null}</div></div></article>;
}
