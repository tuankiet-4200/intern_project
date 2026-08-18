'use client';

import { AddressForm } from '@/components/AddressForm';
import { AppShell } from '@/components/AppShell';
import { SelectMenu } from '@/components/SelectMenu';
import type { AddressDraft } from '@/lib/address';
import { apiRequest, formatVnd } from '@/lib/api';
import { setCartItemCount } from '@/lib/cart-indicator';
import { parseCheckoutItemIds } from '@/lib/checkout-selection';
import { productDetailPath } from '@/lib/product-detail';
import { SepayCheckoutPayload, submitSepayCheckout } from '@/lib/sepay';
import { ArrowLeft, Check, CircleHelp, MapPin, PackageCheck, Tag, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

type CartItem = {
  id: string;
  quantity: number;
  available: number;
  lineTotal: string;
  product: { id: string; name: string; slug: string; price: string; shop: { name: string } };
};
type Cart = { items: CartItem[]; itemCount: number };
type Address = AddressDraft & { id: string; isDefault: boolean };
type Quote = { subtotal: string; discount: string; shipping: string; total: string };
type PaymentMethod = 'COD' | 'BANK_TRANSFER' | 'SEPAY';
type PaymentConfiguration = { provider: 'SEPAY'; configured: boolean };
type CommittedOrder = {
  id: string;
  payments: Array<{ id: string; method: PaymentMethod; status: string }>;
};
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

export default function CheckoutPage() {
  return <Suspense fallback={<AppShell><p className="surface-card p-5">Đang chuẩn bị thanh toán…</p></AppShell>}><CheckoutContent /></Suspense>;
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawSelection = searchParams.get('items');
  const requestedIds = useMemo(() => parseCheckoutItemIds(rawSelection), [rawSelection]);
  const [items, setItems] = useState<CartItem[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [availableCoupons, setAvailableCoupons] = useState<AvailableCoupon[]>([]);
  const [addressId, setAddressId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [sepayConfigured, setSepayConfigured] = useState(false);
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
    if (!requestedIds.length) {
      setItems([]);
      setQuote(null);
      setError('Danh sách sản phẩm thanh toán không hợp lệ. Vui lòng quay lại giỏ hàng và chọn lại.');
      setLoading(false);
      return;
    }
    setItems([]);
    setQuote(null);
    try {
      const [cartResult, addressResult, couponResult, paymentConfiguration] = await Promise.all([
        apiRequest<Cart>('/cart', {}, true),
        apiRequest<Address[]>('/users/me/addresses', {}, true),
        apiRequest<AvailableCoupon[]>('/coupons/available', {}, true),
        apiRequest<PaymentConfiguration>('/payments/sepay/configuration', {}, true),
      ]);
      const requested = new Set(requestedIds);
      const selectedItems = cartResult.items.filter((item) => requested.has(item.id));
      if (selectedItems.length !== requestedIds.length) throw new Error('Một số sản phẩm đã thay đổi hoặc không còn trong giỏ. Vui lòng chọn lại.');
      setItems(selectedItems);
      setCartItemCount(cartResult.itemCount);
      setAddresses(addressResult);
      setAvailableCoupons(couponResult);
      setSepayConfigured(paymentConfiguration.configured);
      setAddressId((current) => current || addressResult.find((address) => address.isDefault)?.id || addressResult[0]?.id || '');
      setShowAddAddress(addressResult.length === 0);
      setQuote(await apiRequest<Quote>('/checkout/quote', {
        method: 'POST',
        body: JSON.stringify({ cartItemIds: requestedIds }),
      }, true));
    } catch (requestError) {
      setQuote(null);
      setError(requestError instanceof Error ? requestError.message : 'Không thể chuẩn bị thanh toán.');
    } finally {
      setLoading(false);
    }
  }, [requestedIds]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

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
        body: JSON.stringify({ cartItemIds: requestedIds, couponCode: normalizedCoupon || undefined }),
      }, true));
      setCouponCode(normalizedCoupon);
      setAppliedCoupon(normalizedCoupon);
      setNotice(normalizedCoupon ? `Đã áp dụng mã ${normalizedCoupon}.` : 'Đã bỏ mã giảm giá.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Mã giảm giá không hợp lệ với các sản phẩm đã chọn.');
    }
  }

  async function placeOrder() {
    if (!addressId) {
      setError('Vui lòng thêm hoặc chọn địa chỉ giao hàng trước khi đặt hàng.');
      return;
    }
    setSubmitting(true);
    setError('');
    setNotice('');
    const signature = JSON.stringify({ cartItemIds: [...requestedIds].sort(), addressId, paymentMethod, couponCode: appliedCoupon || null });
    if (!idempotency.current || idempotency.current.signature !== signature) {
      idempotency.current = { signature, key: crypto.randomUUID() };
    }
    try {
      const order = await apiRequest<CommittedOrder>('/checkout/commit', {
        method: 'POST',
        body: JSON.stringify({
          cartItemIds: requestedIds,
          addressId,
          paymentMethod,
          couponCode: appliedCoupon || undefined,
          idempotencyKey: idempotency.current.key,
        }),
      }, true);
      try {
        const remainingCart = await apiRequest<Cart>('/cart', {}, true);
        setCartItemCount(remainingCart.itemCount);
      } catch {
        // The order is already committed. AppShell will reconcile the badge after navigation.
      }
      if (paymentMethod === 'SEPAY') {
        const payment = order.payments.find((entry) => entry.method === 'SEPAY');
        if (!payment) throw new Error('Đơn hàng đã tạo nhưng không tìm thấy giao dịch SePay.');
        try {
          const checkout = await apiRequest<SepayCheckoutPayload>(
            `/payments/sepay/${payment.id}/checkout`,
            { method: 'POST' },
            true,
          );
          idempotency.current = null;
          submitSepayCheckout(checkout);
          return;
        } catch {
          idempotency.current = null;
          router.push(`/orders?created=${order.id}&payment_error=1`);
          return;
        }
      }
      idempotency.current = null;
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
      <Link href="/cart" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--accent-strong)] hover:underline">
        <ArrowLeft size={16} /> Quay lại giỏ hàng
      </Link>
      <div className="mt-4">
        <p className="eyebrow">Hoàn tất đơn hàng</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.035em]">Thanh toán</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Xác nhận sản phẩm, địa chỉ, ưu đãi và phương thức thanh toán.</p>
      </div>

      {loading ? <p className="surface-card mt-5 p-5">Đang chuẩn bị thanh toán…</p> : null}
      {error ? <p className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {notice ? (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
          <Check size={16} /> {notice}
        </p>
      ) : null}

      {!loading && items.length ? (
        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
          <section className="grid content-start gap-4">
            <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-emerald-50 p-2.5 text-[var(--accent)]"><PackageCheck size={20} /></span>
                <div><h2 className="font-extrabold">Sản phẩm thanh toán</h2><p className="text-xs text-[var(--muted)]">{items.length} dòng đã chọn từ giỏ hàng</p></div>
              </div>
              <div className="mt-4 divide-y divide-[var(--line)]">
                {items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link href={productDetailPath(item.product.slug)} className="font-bold hover:text-[var(--accent)] hover:underline">{item.product.name}</Link>
                      <p className="mt-1 text-xs text-[var(--muted)]">{item.product.shop.name} · {item.quantity} × {formatVnd(item.product.price)}</p>
                    </div>
                    <strong className="shrink-0 text-[var(--accent-strong)]">{formatVnd(item.lineTotal)}</strong>
                  </div>
                ))}
              </div>
            </div>

            <section className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]">
              <div className="flex items-center justify-between gap-3">
                <div><h2 className="text-lg font-extrabold">Thông tin giao hàng</h2><p className="mt-1 text-xs text-[var(--muted)]">Chọn địa chỉ nhận đơn của bạn.</p></div>
                <span className="rounded-xl bg-emerald-50 p-2.5 text-[var(--accent)]"><MapPin size={19} /></span>
              </div>
              {addresses.length ? (
                <div className="mt-4"><SelectMenu label="Địa chỉ giao hàng" value={addressId} options={addressOptions} onChange={setAddressId} placeholder="Chọn một địa chỉ" /></div>
              ) : <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Bạn chưa có địa chỉ giao hàng.</p>}
              <button type="button" className="mt-3 w-full rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 px-3 py-3 text-sm font-bold text-[var(--accent-strong)]" onClick={() => setShowAddAddress((current) => !current)}>
                {showAddAddress ? 'Đóng form địa chỉ mới' : '+ Thêm địa chỉ mới'}
              </button>
              {showAddAddress ? (
                <div className="mt-4 border-t border-[var(--line)] pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-bold">Địa chỉ mới</h3>
                    <button type="button" aria-label="Đóng" className="icon-button !h-8 !w-8" onClick={() => setShowAddAddress(false)}><X size={15} /></button>
                  </div>
                  <AddressForm onSubmit={createAddress} submitLabel="Lưu và sử dụng địa chỉ này" />
                </div>
              ) : null}
            </section>
          </section>

          <aside className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)] xl:sticky xl:top-24">
            <h2 className="text-lg font-extrabold">Thông tin thanh toán</h2>
            <div className="mt-4">
              <SelectMenu<PaymentMethod>
                label="Phương thức thanh toán"
                value={paymentMethod}
                onChange={setPaymentMethod}
                options={[
                  { value: 'COD', label: 'Thanh toán khi nhận hàng', description: 'Thanh toán tiền mặt cho đơn vị vận chuyển' },
                  ...(sepayConfigured ? [{ value: 'SEPAY' as const, label: 'Thanh toán điện tử qua SePay', description: 'Chuyển khoản hoặc quét QR trên cổng SePay bảo mật' }] : []),
                  { value: 'BANK_TRANSFER', label: 'Chuyển khoản ngân hàng', description: 'Xác nhận thanh toán bằng chuyển khoản' },
                ]}
              />
              {!sepayConfigured ? <p className="mt-2 text-xs text-amber-700">SePay chưa được cấu hình trên máy chủ.</p> : null}
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
            <button type="button" className="button-primary mt-5 h-12 w-full" onClick={() => void placeOrder()} disabled={submitting || !quote || !addressId}>
              {submitting ? 'Đang đặt hàng…' : paymentMethod === 'SEPAY' ? 'Thanh toán qua SePay' : 'Đặt hàng'}
            </button>
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
        <CouponDetailRow label="Phạm vi" value={coupon.shop?.name ?? 'Tất cả gian hàng'} />
        <CouponDetailRow label="Đơn tối thiểu" value={coupon.minOrderAmount ? formatVnd(coupon.minOrderAmount) : 'Không yêu cầu'} />
        {coupon.maxDiscount ? <CouponDetailRow label="Giảm tối đa" value={formatVnd(coupon.maxDiscount)} /> : null}
        <CouponDetailRow label="Còn lại toàn chương trình" value={campaignRemaining} />
        <CouponDetailRow label="Lượt dùng của bạn" value={accountRemaining} />
        <CouponDetailRow label="Bắt đầu" value={formatDate(coupon.startsAt, 'Có hiệu lực ngay')} />
        <CouponDetailRow label="Hết hạn" value={formatDate(coupon.expiresAt, 'Không thời hạn')} />
      </dl>
      <button type="button" className="button-primary mt-3 w-full !min-h-9 !py-1.5 text-xs" onClick={onApply}>Dùng mã {coupon.code}</button>
    </div>
  );
}

function CouponDetailRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><dt>{label}</dt><dd className="text-right font-semibold text-[var(--foreground)]">{value}</dd></div>;
}

function couponValue(coupon: AvailableCoupon) {
  return coupon.type === 'PERCENTAGE' ? `Giảm ${Number(coupon.value)}%` : `Giảm ${formatVnd(coupon.value)}`;
}

function formatDate(value: string | null, fallback: string) {
  return value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value)) : fallback;
}
