'use client';

import { AppShell } from '@/components/AppShell';
import { apiRequest, formatVnd } from '@/lib/api';
import {
  Check,
  PackageSearch,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Truck,
} from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';

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
  shop: { name: string };
  category: { id: number; name: string };
  inventory: { onHand: number; reserved: number };
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [addingId, setAddingId] = useState('');

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

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadProducts(search, activeCategory);
  }

  function chooseCategory(categoryId: number | null) {
    setActiveCategory(categoryId);
    void loadProducts(search, categoryId);
  }

  async function addToCart(product: Product) {
    setAddingId(product.id);
    setActionMessage(null);
    try {
      await apiRequest('/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      }, true);
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
                value={search}
                onChange={(event) => setSearch(event.target.value)}
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

      <section id="catalog" className="mt-4 scroll-mt-28">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow">Khám phá marketplace</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.035em]">Sản phẩm dành cho bạn</h2>
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
          <div className="surface-card mt-5 p-10 text-center"><PackageSearch className="mx-auto text-[var(--accent)]" size={34} /><h3 className="mt-4 text-lg font-bold">Chưa tìm thấy sản phẩm phù hợp</h3><p className="mt-1 text-sm text-[var(--muted)]">Hãy thử từ khóa hoặc danh mục khác.</p><button className="button-soft mt-4" onClick={() => { setSearch(''); chooseCategory(null); }}>Xóa bộ lọc</button></div>
        ) : null}

        {!loading && !loadError && products.length > 0 ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} adding={addingId === product.id} onAdd={() => void addToCart(product)} />
            ))}
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}

function ProductCard({ product, index, adding, onAdd }: { product: Product; index: number; adding: boolean; onAdd: () => void }) {
  const available = product.inventory.onHand - product.inventory.reserved;
  const gradients = [
    'from-[#d9eee5] via-[#eef5dc] to-[#f1d4ad]',
    'from-[#e3e6f6] via-[#dbeee9] to-[#c8d8ea]',
    'from-[#f5dfd2] via-[#f0e8cd] to-[#d9e9df]',
    'from-[#dceada] via-[#d7e4ee] to-[#ead8e9]',
  ];
  const image = product.images?.[0];

  return (
    <article className="group overflow-hidden rounded-2xl border border-[var(--line)] bg-white transition duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-md)]">
      <Link
        href={`/products/${product.slug}`}
        aria-label={`Xem chi tiết ${product.name}`}
        className={`relative block aspect-[4/3] overflow-hidden bg-gradient-to-br ${gradients[index % gradients.length]} bg-cover bg-center p-4`}
        style={image ? { backgroundImage: `url(${JSON.stringify(image)})` } : undefined}
      >
        <span className="absolute left-4 top-4 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-bold text-[#315248] shadow-sm backdrop-blur">{product.category.name}</span>
        {!image ? (
          <span className="absolute inset-0 grid place-items-center text-[#244b40]/20"><PackageSearch size={68} strokeWidth={1.2} /></span>
        ) : null}
        <span className="absolute bottom-4 right-4 rounded-lg bg-[#143c32]/90 px-2 py-1 text-[11px] font-bold text-white">Còn {available}</span>
      </Link>
      <div className="p-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)]"><Store size={13} /> {product.shop.name}</p>
        <h3 className="mt-2 line-clamp-2 min-h-12 text-base font-extrabold leading-6"><Link href={`/products/${product.slug}`} className="transition hover:text-[var(--accent)]">{product.name}</Link></h3>
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
