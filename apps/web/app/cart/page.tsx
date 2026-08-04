'use client';

import { AppShell } from '@/components/AppShell';
import { apiRequest, formatVnd } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';

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
type Address = {
  id: string;
  recipient: string;
  line1: string;
  ward: string;
  district: string;
  city: string;
  isDefault: boolean;
};
type Quote = { subtotal: string; discount: string; shipping: string; total: string };

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'BANK_TRANSFER'>('COD');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const idempotency = useRef<{ signature: string; key: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [cartResult, addressResult] = await Promise.all([
        apiRequest<Cart>('/cart', {}, true),
        apiRequest<Address[]>('/users/me/addresses', {}, true),
      ]);
      setCart(cartResult);
      setAddresses(addressResult);
      setAddressId((current) => current || addressResult.find((address) => address.isDefault)?.id || addressResult[0]?.id || '');
      setQuote(cartResult.items.length ? await apiRequest<Quote>('/checkout/quote', { method: 'POST', body: '{}' }, true) : null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load cart');
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
    try {
      const nextCart = await apiRequest<Cart>(path, init, true);
      setCart(nextCart);
      setQuote(nextCart.items.length ? await apiRequest<Quote>('/checkout/quote', {
        method: 'POST',
        body: JSON.stringify({ couponCode: appliedCoupon || undefined }),
      }, true) : null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update cart');
    }
  }

  async function applyCoupon() {
    setError('');
    try {
      const normalizedCoupon = couponCode.trim().toUpperCase();
      setQuote(await apiRequest<Quote>('/checkout/quote', {
        method: 'POST',
        body: JSON.stringify({ couponCode: normalizedCoupon || undefined }),
      }, true));
      setAppliedCoupon(normalizedCoupon);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to apply coupon');
    }
  }

  async function checkout(event: FormEvent) {
    event.preventDefault();
    if (!addressId) {
      setError('Add a shipping address before checkout.');
      return;
    }
    setSubmitting(true);
    setError('');
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
      router.push(`/orders?created=${order.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Checkout failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">Cart & checkout</h1>
      {loading ? <p className="mt-4 rounded-md border border-[var(--line)] bg-white p-4">Loading cart…</p> : null}
      {error ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {!loading && cart?.items.length === 0 ? (
        <div className="mt-4 rounded-md border border-[var(--line)] bg-white p-5">
          <p className="text-[var(--muted)]">Your cart is empty.</p>
          <Link href="/" className="mt-3 inline-block rounded bg-[var(--accent)] px-4 py-2 text-sm text-white">Browse products</Link>
        </div>
      ) : null}

      {cart?.items.length ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
          <section className="grid content-start gap-3">
            {cart.items.map((item) => (
              <article key={item.id} className="rounded-md border border-[var(--line)] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{item.product.name}</h2>
                    <p className="text-sm text-[var(--muted)]">{item.product.shop.name} · {formatVnd(item.product.price)}</p>
                    {!item.isValid ? <p className="mt-1 text-sm text-red-700">{item.errors.join(', ')}</p> : null}
                  </div>
                  <strong>{formatVnd(item.lineTotal)}</strong>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <button className="h-9 w-9 rounded border border-[var(--line)]" disabled={item.quantity <= 1} onClick={() => void mutate(`/cart/items/${item.id}`, { method: 'PATCH', body: JSON.stringify({ quantity: item.quantity - 1 }) })}>−</button>
                  <span className="min-w-10 text-center">{item.quantity}</span>
                  <button className="h-9 w-9 rounded border border-[var(--line)]" disabled={item.quantity >= item.available} onClick={() => void mutate(`/cart/items/${item.id}`, { method: 'PATCH', body: JSON.stringify({ quantity: item.quantity + 1 }) })}>+</button>
                  <button className="ml-auto text-sm text-red-700" onClick={() => void mutate(`/cart/items/${item.id}`, { method: 'DELETE' })}>Remove</button>
                </div>
              </article>
            ))}
          </section>

          <form className="grid content-start gap-3 rounded-md border border-[var(--line)] bg-white p-4" onSubmit={checkout}>
            <h2 className="font-semibold">Checkout</h2>
            <label className="grid gap-1 text-sm">
              Shipping address
              <select className="h-10 rounded border border-[var(--line)] px-2" value={addressId} onChange={(event) => setAddressId(event.target.value)}>
                <option value="">Select an address</option>
                {addresses.map((address) => <option key={address.id} value={address.id}>{address.recipient} — {address.line1}, {address.city}</option>)}
              </select>
            </label>
            {addresses.length === 0 ? <Link href="/profile" className="text-sm text-[var(--accent-strong)]">Add an address in your profile</Link> : null}
            <label className="grid gap-1 text-sm">
              Payment method
              <select className="h-10 rounded border border-[var(--line)] px-2" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as 'COD' | 'BANK_TRANSFER')}>
                <option value="COD">Cash on delivery</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
              </select>
            </label>
            <div className="flex gap-2">
              <input className="h-10 min-w-0 flex-1 rounded border border-[var(--line)] px-3" value={couponCode} onChange={(event) => setCouponCode(event.target.value)} placeholder="Coupon code" />
              <button type="button" className="rounded border border-[var(--line)] px-3 text-sm" onClick={() => void applyCoupon()}>Apply</button>
            </div>
            {appliedCoupon ? <p className="text-xs text-emerald-700">Applied: {appliedCoupon}</p> : null}
            {quote ? (
              <dl className="grid gap-2 border-t border-[var(--line)] pt-3 text-sm">
                <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatVnd(quote.subtotal)}</dd></div>
                <div className="flex justify-between"><dt>Discount</dt><dd>−{formatVnd(quote.discount)}</dd></div>
                <div className="flex justify-between"><dt>Shipping</dt><dd>{formatVnd(quote.shipping)}</dd></div>
                <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd>{formatVnd(quote.total)}</dd></div>
              </dl>
            ) : null}
            <button className="h-11 rounded bg-[var(--accent)] font-medium text-white disabled:opacity-60" disabled={submitting || !cart.isValid || !addressId}>
              {submitting ? 'Placing order…' : 'Place order'}
            </button>
          </form>
        </div>
      ) : null}
    </AppShell>
  );
}
