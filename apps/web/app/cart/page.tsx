'use client';

import { AppShell } from '@/components/AppShell';
import { apiRequest, formatVnd } from '@/lib/api';
import { setCartItemCount } from '@/lib/cart-indicator';
import { checkoutPath, reconcileCartSelection, toggleCartSelection } from '@/lib/checkout-selection';
import { productDetailPath } from '@/lib/product-detail';
import { ChevronRight, Minus, Plus, ShoppingBag, ShoppingCart, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

type CartItem = {
  id: string;
  quantity: number;
  available: number;
  lineTotal: string;
  isValid: boolean;
  errors: string[];
  product: {
    id: string;
    name: string;
    slug: string;
    price: string;
    images: string[];
    shop: { name: string };
  };
};
type Cart = { items: CartItem[]; itemCount: number; subtotal: string; isValid: boolean };

const EMPTY_SELECTION = new Set<string>();

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutatingId, setMutatingId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest<Cart>('/cart', {}, true);
      setCart(result);
      setCartItemCount(result.itemCount);
      setSelectedIds((current) => reconcileCartSelection(current, result.items));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể tải giỏ hàng.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function mutate(itemId: string, path: string, init: RequestInit) {
    setMutatingId(itemId);
    setError('');
    try {
      const nextCart = await apiRequest<Cart>(path, init, true);
      setCart(nextCart);
      setCartItemCount(nextCart.itemCount);
      setSelectedIds((current) => reconcileCartSelection(current, nextCart.items));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể cập nhật giỏ hàng.');
    } finally {
      setMutatingId('');
    }
  }

  const selected = useMemo(() => selectedIds ?? EMPTY_SELECTION, [selectedIds]);
  const selectableIds = useMemo(() => cart?.items.filter((item) => item.isValid).map((item) => item.id) ?? [], [cart]);
  const selectedItems = useMemo(() => cart?.items.filter((item) => selected.has(item.id)) ?? [], [cart, selected]);
  const allSelected = selectableIds.length > 0 && selectableIds.every((itemId) => selected.has(itemId));
  const selectedQuantity = selectedItems.reduce((sum, item) => sum + item.quantity, 0);

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(selectableIds));
  }

  function continueToCheckout() {
    if (!selected.size) return;
    router.push(checkoutPath(selected));
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Đơn hàng của bạn</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.035em]">Giỏ hàng</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Chọn sản phẩm muốn mua rồi tiếp tục sang trang thanh toán.</p>
        </div>
        {cart?.itemCount ? <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-bold text-emerald-800">{cart.itemCount} sản phẩm</span> : null}
      </div>

      {loading ? <p className="mt-5 rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]">Đang tải giỏ hàng…</p> : null}
      {error ? <p className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {!loading && cart?.items.length === 0 ? (
        <div className="mt-5 rounded-3xl border border-[var(--line)] bg-white p-10 text-center shadow-[var(--shadow-sm)]">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-[var(--accent)]"><ShoppingBag size={28} /></span>
          <h2 className="mt-5 text-xl font-extrabold">Giỏ hàng của bạn đang trống</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Khám phá sản phẩm từ các gian hàng đã được kiểm duyệt.</p>
          <Link href="/" className="button-primary mt-5">Khám phá sản phẩm <ChevronRight size={17} /></Link>
        </div>
      ) : null}

      {cart?.items.length ? (
        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="grid content-start gap-3">
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-5 py-3 text-sm font-bold shadow-[var(--shadow-sm)]">
              <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={allSelected} onChange={toggleAll} />
              Chọn tất cả sản phẩm hợp lệ ({selectableIds.length})
            </label>
            {cart.items.map((item) => {
              const image = item.product.images[0];
              return (
                <article key={item.id} className={`rounded-2xl border bg-white p-4 shadow-[var(--shadow-sm)] transition ${selected.has(item.id) ? 'border-emerald-400' : 'border-[var(--line)]'}`}>
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      className="mt-8 h-4 w-4 shrink-0 accent-[var(--accent)]"
                      checked={selected.has(item.id)}
                      disabled={!item.isValid}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setSelectedIds((current) => toggleCartSelection(current ?? EMPTY_SELECTION, item.id, checked));
                      }}
                      aria-label={`Chọn ${item.product.name} để thanh toán`}
                    />
                    <Link href={productDetailPath(item.product.slug)} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#d9eee5] to-[#f1d4ad] bg-cover bg-center" style={image ? { backgroundImage: `url(${JSON.stringify(image)})` } : undefined} aria-label={`Xem chi tiết ${item.product.name}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h2 className="font-extrabold leading-6"><Link href={productDetailPath(item.product.slug)} className="hover:text-[var(--accent)] hover:underline">{item.product.name}</Link></h2>
                          <p className="mt-1 text-sm text-[var(--muted)]">{item.product.shop.name} · {formatVnd(item.product.price)}</p>
                        </div>
                        <strong className="text-lg text-[var(--accent-strong)]">{formatVnd(item.lineTotal)}</strong>
                      </div>
                      {!item.isValid ? <p className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-700">{item.errors.join(', ')}</p> : null}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="mr-1 text-xs font-semibold text-[var(--muted)]">Số lượng</span>
                        <button type="button" aria-label="Giảm số lượng" className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)]" disabled={item.quantity <= 1 || mutatingId === item.id} onClick={() => void mutate(item.id, `/cart/items/${item.id}`, { method: 'PATCH', body: JSON.stringify({ quantity: item.quantity - 1 }) })}><Minus size={15} /></button>
                        <span className="min-w-8 text-center font-bold">{item.quantity}</span>
                        <button type="button" aria-label="Tăng số lượng" className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)]" disabled={item.quantity >= item.available || mutatingId === item.id} onClick={() => void mutate(item.id, `/cart/items/${item.id}`, { method: 'PATCH', body: JSON.stringify({ quantity: item.quantity + 1 }) })}><Plus size={15} /></button>
                        <span className="ml-1 text-xs text-[var(--muted)]">Kho: {item.available}</span>
                        <button type="button" className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-red-700" disabled={mutatingId === item.id} onClick={() => void mutate(item.id, `/cart/items/${item.id}`, { method: 'DELETE' })}><Trash2 size={15} /> Xóa</button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>

          <aside className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)] xl:sticky xl:top-24">
            <div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-50 p-2.5 text-[var(--accent)]"><ShoppingCart size={20} /></span><div><h2 className="font-extrabold">Sản phẩm đã chọn</h2><p className="text-xs text-[var(--muted)]">{selected.size} dòng · {selectedQuantity} sản phẩm</p></div></div>
            <p className="mt-4 text-sm leading-6 text-[var(--muted)]">Địa chỉ, phương thức thanh toán và mã giảm giá sẽ được nhập ở bước tiếp theo.</p>
            <button type="button" className="button-primary mt-5 h-12 w-full" disabled={selected.size === 0} onClick={continueToCheckout}>Thanh toán ({selectedQuantity}) <ChevronRight size={17} /></button>
            {!selected.size ? <p className="mt-2 text-center text-xs text-amber-700">Hãy chọn ít nhất một sản phẩm hợp lệ.</p> : null}
          </aside>
        </div>
      ) : null}
    </AppShell>
  );
}
