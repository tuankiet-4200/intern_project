'use client';

import { AddressForm } from '@/components/AddressForm';
import { AppShell } from '@/components/AppShell';
import { SelectMenu } from '@/components/SelectMenu';
import type { AddressDraft } from '@/lib/address';
import { apiRequest, formatVnd } from '@/lib/api';
import { resetCartItemCount, setCartItemCount } from '@/lib/cart-indicator';
import { Check, ChevronRight, CircleHelp, MapPin, Minus, Plus, ShoppingBag, Tag, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

type CartItem = {
  id: string;
  quantity: number;
  available: number;
  lineTotal: string;
  isValid: boolean;
  errors: string[];
  product: { id: string; name: string; price: string; shop: { name: string } };
};
type Cart = { items: CartItem[]; itemCount: number; subtotal: string; isValid: boolean };
type Address = AddressDraft & {
  id: string;
  isDefault: boolean;
};
type Quote = { subtotal: string; discount: string; shipping: string; total: string };
type PaymentMethod = 'COD' | 'BANK_TRANSFER';
type AvailableCoupon = {
  id: string;
  code: string;
  scope: 'GLOBAL' | 'SHOP';
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: string;
  minOrderAmount: string | null;
  maxDiscount: string | null;
  usageLimit: number | null;
  usedCount: number;
  perUserLimit: number | null;
  accountUsedCount: number;
  accountRemaining: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  shop: { name: string } | null;
};

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [availableCoupons, setAvailableCoupons] = useState<AvailableCoupon[]>([]);
  const [addressId, setAddressId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [selectedCouponId, setSelectedCouponId] = useState('');
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const idempotency = useRef<{ signature: string; key: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [cartResult, addressResult, couponResult] = await Promise.all([
        apiRequest<Cart>('/cart', {}, true),
        apiRequest<Address[]>('/users/me/addresses', {}, true),
        apiRequest<AvailableCoupon[]>('/coupons/available', {}, true),
      ]);
      setCart(cartResult);
      setCartItemCount(cartResult.itemCount);
      setAddresses(addressResult);
      setAvailableCoupons(couponResult);
      setAddressId((current) => current || addressResult.find((address) => address.isDefault)?.id || addressResult[0]?.id || '');
      setShowAddAddress(addressResult.length === 0);
      setQuote(cartResult.items.length ? await apiRequest<Quote>('/checkout/quote', { method: 'POST', body: '{}' }, true) : null);
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

  async function mutate(path: string, init: RequestInit) {
    setError('');
    setNotice('');
    try {
      const nextCart = await apiRequest<Cart>(path, init, true);
      setCart(nextCart);
      setCartItemCount(nextCart.itemCount);
      setQuote(nextCart.items.length ? await apiRequest<Quote>('/checkout/quote', {
        method: 'POST',
        body: JSON.stringify({ couponCode: appliedCoupon || undefined }),
      }, true) : null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể cập nhật giỏ hàng.');
    }
  }

  async function createAddress(address: AddressDraft) {
    setError('');
    setNotice('');
    try {
      const created = await apiRequest<Address>('/users/me/addresses', {
        method: 'POST',
        body: JSON.stringify(address),
      }, true);
      setAddresses((current) => [created, ...current]);
      setAddressId(created.id);
      setShowAddAddress(false);
      setNotice('Đã lưu và chọn địa chỉ giao hàng mới.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể thêm địa chỉ.');
      throw requestError;
    }
  }

  async function applyCoupon(code = couponCode) {
    setError('');
    setNotice('');
    try {
      const normalizedCoupon = code.trim().toUpperCase();
      setQuote(await apiRequest<Quote>('/checkout/quote', {
        method: 'POST',
        body: JSON.stringify({ couponCode: normalizedCoupon || undefined }),
      }, true));
      setCouponCode(normalizedCoupon);
      setAppliedCoupon(normalizedCoupon);
      setNotice(normalizedCoupon ? `Đã áp dụng mã ${normalizedCoupon}.` : 'Đã bỏ mã giảm giá.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Mã giảm giá không hợp lệ với giỏ hàng này.');
    }
  }

  async function checkout() {
    if (!addressId) {
      setError('Vui lòng thêm hoặc chọn địa chỉ giao hàng trước khi đặt hàng.');
      return;
    }
    setSubmitting(true);
    setError('');
    setNotice('');
    const signature = JSON.stringify({ addressId, paymentMethod, couponCode: appliedCoupon || null });
    if (!idempotency.current || idempotency.current.signature !== signature) {
      idempotency.current = { signature, key: crypto.randomUUID() };
    }
    try {
      const order = await apiRequest<{ id: string }>('/checkout/commit', {
        method: 'POST',
        body: JSON.stringify({
          addressId,
          paymentMethod,
          couponCode: appliedCoupon || undefined,
          idempotencyKey: idempotency.current.key,
        }),
      }, true);
      idempotency.current = null;
      resetCartItemCount();
      router.push(`/orders?created=${order.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể đặt hàng. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedCoupon = availableCoupons.find((coupon) => coupon.id === selectedCouponId) ?? null;
  const addressOptions = addresses.map((address) => ({
    value: address.id,
    label: `${address.recipient}${address.isDefault ? ' · Mặc định' : ''}`,
    description: `${address.line1}, ${address.ward}, ${address.district}, ${address.city}`,
  }));

  return (
    <AppShell>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">Hoàn tất đơn hàng</p>
          <h1 className="mt-1 text-3xl font-black tracking-[-0.035em]">Giỏ hàng và thanh toán</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Kiểm tra sản phẩm, địa chỉ nhận hàng và ưu đãi trước khi đặt hàng.</p>
        </div>
        {cart?.itemCount ? <span className="hidden rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-bold text-emerald-800 sm:block">{cart.itemCount} sản phẩm</span> : null}
      </div>

      {loading ? <p className="mt-5 rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]">Đang tải giỏ hàng…</p> : null}
      {error ? <p className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800"><Check size={16} /> {notice}</p> : null}
      {!loading && cart?.items.length === 0 ? (
        <div className="mt-5 rounded-3xl border border-[var(--line)] bg-white p-10 text-center shadow-[var(--shadow-sm)]">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-[var(--accent)]"><ShoppingBag size={28} /></span>
          <h2 className="mt-5 text-xl font-extrabold">Giỏ hàng của bạn đang trống</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Khám phá sản phẩm từ các gian hàng đã được kiểm duyệt.</p>
          <Link href="/" className="button-primary mt-5">Khám phá sản phẩm <ChevronRight size={17} /></Link>
        </div>
      ) : null}

      {cart?.items.length ? (
        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
          <section className="grid content-start gap-3">
            {cart.items.map((item) => (
              <article key={item.id} className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-extrabold leading-6">{item.product.name}</h2>
                    <p className="mt-1 text-sm text-[var(--muted)]">{item.product.shop.name} · {formatVnd(item.product.price)}</p>
                    {!item.isValid ? <p className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-700">{item.errors.join(', ')}</p> : null}
                  </div>
                  <strong className="text-lg text-[var(--accent-strong)]">{formatVnd(item.lineTotal)}</strong>
                </div>
                <div className="mt-5 flex items-center gap-2">
                  <span className="mr-1 text-xs font-semibold text-[var(--muted)]">Số lượng</span>
                  <button type="button" aria-label="Giảm số lượng" className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] transition hover:border-[var(--accent)]" disabled={item.quantity <= 1} onClick={() => void mutate(`/cart/items/${item.id}`, { method: 'PATCH', body: JSON.stringify({ quantity: item.quantity - 1 }) })}><Minus size={15} /></button>
                  <span className="min-w-10 text-center font-bold">{item.quantity}</span>
                  <button type="button" aria-label="Tăng số lượng" className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] transition hover:border-[var(--accent)]" disabled={item.quantity >= item.available} onClick={() => void mutate(`/cart/items/${item.id}`, { method: 'PATCH', body: JSON.stringify({ quantity: item.quantity + 1 }) })}><Plus size={15} /></button>
                  <span className="ml-2 text-xs text-[var(--muted)]">Còn {item.available}</span>
                  <button type="button" className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-red-700" onClick={() => void mutate(`/cart/items/${item.id}`, { method: 'DELETE' })}><Trash2 size={15} /> Xóa</button>
                </div>
              </article>
            ))}
          </section>

          <aside className="grid content-start gap-4 xl:sticky xl:top-24">
            <section className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]">
              <div className="flex items-center justify-between gap-3">
                <div><h2 className="text-lg font-extrabold">Thông tin giao hàng</h2><p className="mt-1 text-xs text-[var(--muted)]">Chọn địa chỉ nhận đơn của bạn.</p></div>
                <span className="rounded-xl bg-emerald-50 p-2.5 text-[var(--accent)]"><MapPin size={19} /></span>
              </div>
              {addresses.length ? (
                <div className="mt-4">
                  <SelectMenu label="Địa chỉ giao hàng" value={addressId} options={addressOptions} onChange={setAddressId} placeholder="Chọn một địa chỉ" />
                </div>
              ) : <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Bạn chưa có địa chỉ giao hàng.</p>}
              <button type="button" className="mt-3 w-full rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 px-3 py-3 text-sm font-bold text-[var(--accent-strong)] transition hover:bg-emerald-50" onClick={() => setShowAddAddress((current) => !current)}>
                {showAddAddress ? 'Đóng form địa chỉ mới' : '+ Thêm địa chỉ mới'}
              </button>
              {showAddAddress ? (
                <div className="mt-4 border-t border-[var(--line)] pt-4">
                  <div className="mb-3 flex items-center justify-between"><h3 className="font-bold">Địa chỉ mới</h3><button type="button" aria-label="Đóng" className="icon-button !h-8 !w-8" onClick={() => setShowAddAddress(false)}><X size={15} /></button></div>
                  <AddressForm onSubmit={createAddress} submitLabel="Lưu và sử dụng địa chỉ này" />
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]">
              <h2 className="text-lg font-extrabold">Thanh toán</h2>
              <div className="mt-4">
                <SelectMenu<PaymentMethod>
                  label="Phương thức thanh toán"
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  options={[
                    { value: 'COD', label: 'Thanh toán khi nhận hàng', description: 'Thanh toán tiền mặt cho đơn vị vận chuyển' },
                    { value: 'BANK_TRANSFER', label: 'Chuyển khoản ngân hàng', description: 'Xác nhận thanh toán bằng chuyển khoản' },
                  ]}
                />
              </div>

              <div className="mt-5 border-t border-[var(--line)] pt-4">
                <div className="flex items-center gap-2"><Tag size={17} className="text-[var(--accent)]" /><h3 className="font-bold">Mã giảm giá</h3></div>
                <div className="mt-3 flex gap-2">
                  <input className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--line)] px-3 uppercase" value={couponCode} onChange={(event) => setCouponCode(event.target.value)} placeholder="Nhập mã coupon" />
                  <button type="button" className="button-soft !px-3" onClick={() => void applyCoupon()}>Áp dụng</button>
                </div>
                {availableCoupons.length ? (
                  <div className="mt-3 grid max-h-52 gap-2 overflow-y-auto pr-1">
                    {availableCoupons.map((coupon) => {
                      const selected = selectedCouponId === coupon.id;
                      return (
                        <button key={coupon.id} type="button" className={`rounded-xl border p-3 text-left transition ${selected ? 'border-emerald-400 bg-emerald-50' : 'border-[var(--line)] hover:border-emerald-300'}`} onClick={() => setSelectedCouponId(selected ? '' : coupon.id)}>
                          <span className="flex items-center justify-between gap-2"><strong className="text-sm text-[var(--accent-strong)]">{coupon.code}</strong><span className="text-xs font-bold">{couponValue(coupon)}</span></span>
                          <span className="mt-1 block text-xs text-[var(--muted)]">{coupon.shop ? `Dành cho ${coupon.shop.name}` : 'Áp dụng cho mọi gian hàng'}</span>
                          <span className="mt-2 flex items-center gap-1 text-xs font-semibold text-[var(--accent)]"><CircleHelp size={13} /> {selected ? 'Ẩn chi tiết' : 'Xem chi tiết'}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : <p className="mt-3 text-xs text-[var(--muted)]">Hiện chưa có mã giảm giá khả dụng.</p>}

                {selectedCoupon ? <CouponDetail coupon={selectedCoupon} onApply={() => void applyCoupon(selectedCoupon.code)} /> : null}
                {appliedCoupon ? <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><Check size={14} /> Đang áp dụng: {appliedCoupon}</p> : null}
              </div>

              {quote ? (
                <dl className="mt-5 grid gap-2.5 border-t border-[var(--line)] pt-4 text-sm">
                  <div className="flex justify-between"><dt className="text-[var(--muted)]">Tạm tính</dt><dd>{formatVnd(quote.subtotal)}</dd></div>
                  <div className="flex justify-between"><dt className="text-[var(--muted)]">Giảm giá</dt><dd className="text-emerald-700">−{formatVnd(quote.discount)}</dd></div>
                  <div className="flex justify-between"><dt className="text-[var(--muted)]">Phí vận chuyển</dt><dd>{formatVnd(quote.shipping)}</dd></div>
                  <div className="mt-1 flex justify-between border-t border-dashed border-[var(--line)] pt-3 text-lg font-extrabold"><dt>Tổng thanh toán</dt><dd className="text-[var(--accent-strong)]">{formatVnd(quote.total)}</dd></div>
                </dl>
              ) : null}
              <button type="button" className="button-primary mt-5 h-12 w-full" onClick={() => void checkout()} disabled={submitting || !cart.isValid || !addressId}>
                {submitting ? 'Đang đặt hàng…' : 'Đặt hàng'}
              </button>
            </section>
          </aside>
        </div>
      ) : null}
    </AppShell>
  );
}

function CouponDetail({ coupon, onApply }: { coupon: AvailableCoupon; onApply: () => void }) {
  const campaignRemaining = coupon.usageLimit === null ? 'Không giới hạn' : `${Math.max(0, coupon.usageLimit - coupon.usedCount)} lượt`;
  const accountRemaining = coupon.accountRemaining === null ? 'Không giới hạn' : `${coupon.accountRemaining} lượt`;
  return (
    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs">
      <div className="flex items-center justify-between gap-2"><strong className="text-sm">Chi tiết {coupon.code}</strong><span className="rounded-full bg-white px-2 py-1 font-bold text-[var(--accent-strong)]">{couponValue(coupon)}</span></div>
      <dl className="mt-3 grid gap-2 text-[var(--muted)]">
        <div className="flex justify-between gap-3"><dt>Phạm vi</dt><dd className="text-right font-semibold text-[var(--foreground)]">{coupon.shop?.name ?? 'Tất cả gian hàng'}</dd></div>
        <div className="flex justify-between gap-3"><dt>Đơn tối thiểu</dt><dd className="font-semibold text-[var(--foreground)]">{coupon.minOrderAmount ? formatVnd(coupon.minOrderAmount) : 'Không yêu cầu'}</dd></div>
        {coupon.maxDiscount ? <div className="flex justify-between gap-3"><dt>Giảm tối đa</dt><dd className="font-semibold text-[var(--foreground)]">{formatVnd(coupon.maxDiscount)}</dd></div> : null}
        <div className="flex justify-between gap-3"><dt>Còn lại toàn chương trình</dt><dd className="font-semibold text-[var(--foreground)]">{campaignRemaining}</dd></div>
        <div className="flex justify-between gap-3"><dt>Lượt dùng của bạn</dt><dd className="font-semibold text-[var(--foreground)]">{accountRemaining}</dd></div>
        <div className="flex justify-between gap-3"><dt>Bắt đầu</dt><dd className="font-semibold text-[var(--foreground)]">{formatDate(coupon.startsAt, 'Có hiệu lực ngay')}</dd></div>
        <div className="flex justify-between gap-3"><dt>Hết hạn</dt><dd className="font-semibold text-[var(--foreground)]">{formatDate(coupon.expiresAt, 'Không thời hạn')}</dd></div>
      </dl>
      <button type="button" className="button-primary mt-3 w-full !min-h-9 !py-1.5 text-xs" onClick={onApply}>Dùng mã {coupon.code}</button>
    </div>
  );
}

function couponValue(coupon: AvailableCoupon) {
  return coupon.type === 'PERCENTAGE' ? `Giảm ${Number(coupon.value)}%` : `Giảm ${formatVnd(coupon.value)}`;
}

function formatDate(value: string | null, fallback: string) {
  return value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value)) : fallback;
}
