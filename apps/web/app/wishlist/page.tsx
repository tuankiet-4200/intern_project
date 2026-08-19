'use client';

import { AppShell } from '@/components/AppShell';
import { apiRequest, formatVnd } from '@/lib/api';
import { setCartItemCount } from '@/lib/cart-indicator';
import { productDetailPath } from '@/lib/product-detail';
import type { WishlistPage, WishlistProduct } from '@/lib/wishlist';
import { setWishlistItemCount } from '@/lib/wishlist-indicator';
import { ChevronLeft, ChevronRight, Heart, PackageSearch, RefreshCw, ShoppingCart, Store, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

export default function WishlistPage() {
  const [result, setResult] = useState<WishlistPage>({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState('');
  const [addingId, setAddingId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = await apiRequest<WishlistPage>(`/wishlist?page=${page}&limit=20`, {}, true);
      if (page > 1 && next.items.length === 0 && next.total > 0) {
        setPage(page - 1);
        return;
      }
      setResult(next);
      setWishlistItemCount(next.total);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể tải danh sách yêu thích.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function remove(product: WishlistProduct) {
    setRemovingId(product.id);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/wishlist/items/${product.id}`, { method: 'DELETE' }, true);
      setMessage(`Đã bỏ “${product.name}” khỏi danh sách yêu thích.`);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể xóa sản phẩm yêu thích.');
    } finally {
      setRemovingId('');
    }
  }

  async function addToCart(product: WishlistProduct) {
    setAddingId(product.id);
    setError('');
    setMessage('');
    try {
      const cart = await apiRequest<{ itemCount: number }>('/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      }, true);
      setCartItemCount(cart.itemCount);
      setMessage(`Đã thêm “${product.name}” vào giỏ hàng.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể thêm sản phẩm vào giỏ hàng.');
    } finally {
      setAddingId('');
    }
  }

  return (
    <AppShell>
      <section>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="eyebrow">Danh sách của bạn</p><h1 className="mt-2 text-3xl font-black tracking-[-0.035em]">Sản phẩm yêu thích</h1><p className="mt-2 text-sm text-[var(--muted)]">Lưu sản phẩm để quay lại so sánh và mua khi phù hợp.</p></div>
          <button type="button" className="button-ghost self-start" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Làm mới</button>
        </div>

        <div className="mt-5 flex items-center justify-between text-sm text-[var(--muted)]"><span><strong className="text-[var(--foreground)]">{result.total}</strong> sản phẩm đã lưu</span><span>Trang {result.page}/{Math.max(result.totalPages, 1)}</span></div>
        {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {message ? <p className="mt-4 rounded-xl bg-emerald-100 p-3 text-sm text-emerald-800">{message}</p> : null}

        {loading ? <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="surface-card h-96 animate-pulse" />)}</div> : null}
        {!loading && result.items.length === 0 ? (
          <div className="surface-card mt-5 grid min-h-80 place-items-center p-8 text-center"><div><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-500"><Heart size={30} /></span><h2 className="mt-4 text-xl font-black">Chưa có sản phẩm yêu thích</h2><p className="mt-2 text-sm text-[var(--muted)]">Bấm biểu tượng trái tim trên card sản phẩm để lưu lại.</p><Link href="/" className="button-primary mt-5">Khám phá sản phẩm</Link></div></div>
        ) : null}

        {!loading && result.items.length > 0 ? <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{result.items.map(({ id, product }) => <WishlistCard key={id} product={product} removing={removingId === product.id} adding={addingId === product.id} onRemove={() => void remove(product)} onAdd={() => void addToCart(product)} />)}</div> : null}

        {result.totalPages > 1 ? <div className="mt-6 flex justify-center gap-2"><button type="button" className="button-ghost !h-10 !px-3" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /> Trước</button><button type="button" className="button-ghost !h-10 !px-3" disabled={page >= result.totalPages || loading} onClick={() => setPage(page + 1)}>Sau <ChevronRight size={16} /></button></div> : null}
      </section>
    </AppShell>
  );
}

function WishlistCard({ product, removing, adding, onRemove, onAdd }: { product: WishlistProduct; removing: boolean; adding: boolean; onRemove: () => void; onAdd: () => void }) {
  const image = product.images[0];
  return <article className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[var(--shadow-sm)]"><Link href={productDetailPath(product.slug)} className="relative block aspect-[4/3] bg-gradient-to-br from-[#dcebe5] via-[#edf2de] to-[#f3dbc2] bg-cover bg-center" style={image ? { backgroundImage: `url(${JSON.stringify(image)})` } : undefined}>{!image ? <span className="absolute inset-0 grid place-items-center text-[#244b40]/20"><PackageSearch size={62} strokeWidth={1.2} /></span> : null}<span className={`absolute bottom-3 right-3 rounded-lg px-2 py-1 text-[11px] font-bold ${product.isPurchasable ? 'bg-[#143c32]/90 text-white' : 'bg-red-100 text-red-700'}`}>{product.isPurchasable ? `Còn ${product.available}` : 'Tạm ngừng bán'}</span></Link><div className="p-4"><p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)]"><Store size={13} /> {product.shop.name}</p><h2 className="mt-2 line-clamp-2 min-h-12 font-extrabold leading-6"><Link href={productDetailPath(product.slug)}>{product.name}</Link></h2><p className="mt-3 text-lg font-black text-[var(--accent-strong)]">{formatVnd(product.price)}</p><div className="mt-4 grid grid-cols-[auto_1fr] gap-2 border-t border-[var(--line)] pt-4"><button type="button" className="icon-button !border-red-200 !text-red-600" disabled={removing} onClick={onRemove} aria-label={`Bỏ ${product.name} khỏi yêu thích`}>{removing ? <span className="loading-spinner !h-4 !w-4 !border-2" /> : <Trash2 size={17} />}</button><button type="button" className="button-primary" disabled={!product.isPurchasable || adding} onClick={onAdd}>{adding ? <span className="loading-spinner !h-4 !w-4 !border-2 !border-white/40 !border-t-white" /> : <ShoppingCart size={17} />}{product.isPurchasable ? 'Thêm vào giỏ' : 'Không thể mua'}</button></div></div></article>;
}
