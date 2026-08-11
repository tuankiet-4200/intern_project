'use client';

import { AppShell } from '@/components/AppShell';
import { apiRequest, formatVnd } from '@/lib/api';
import { FormEvent, useCallback, useEffect, useState } from 'react';

type Shop = { id: string; name: string; status: string };
type Coupon = {
  id: string;
  code: string;
  shopId: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: string;
  minOrderAmount: string | null;
  maxDiscount: string | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  shop: { name: string };
};
type CouponPage = { data: Coupon[] };
type FormState = {
  code: string;
  shopId: string;
  type: Coupon['type'];
  value: string;
  minOrderAmount: string;
  maxDiscount: string;
  usageLimit: string;
  perUserLimit: string;
  startsAt: string;
  expiresAt: string;
};

const EMPTY_FORM: FormState = {
  code: '', shopId: '', type: 'PERCENTAGE', value: '', minOrderAmount: '',
  maxDiscount: '', usageLimit: '', perUserLimit: '', startsAt: '', expiresAt: '',
};

export default function VendorCouponsPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [mine, campaigns] = await Promise.all([
        apiRequest<Shop[]>('/shops/me', {}, true),
        apiRequest<CouponPage>('/vendor/coupons?limit=100', {}, true),
      ]);
      const approved = mine.filter((shop) => shop.status === 'APPROVED');
      setShops(approved);
      setCoupons(campaigns.data);
      setForm((current) => ({ ...current, shopId: current.shopId || approved[0]?.id || '' }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load shop coupons');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiRequest(editingId ? `/vendor/coupons/${editingId}` : '/vendor/coupons', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          code: form.code,
          scope: 'SHOP',
          shopId: form.shopId,
          type: form.type,
          value: form.value,
          minOrderAmount: optionalText(form.minOrderAmount, editingId),
          maxDiscount: optionalText(form.maxDiscount, editingId),
          usageLimit: optionalNumber(form.usageLimit, editingId),
          perUserLimit: optionalNumber(form.perUserLimit, editingId),
          startsAt: optionalDate(form.startsAt, editingId),
          expiresAt: optionalDate(form.expiresAt, editingId),
        }),
      }, true);
      setEditingId(null);
      setForm({ ...EMPTY_FORM, shopId: shops[0]?.id || '' });
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save coupon');
    } finally {
      setSaving(false);
    }
  }

  function edit(coupon: Coupon) {
    setEditingId(coupon.id);
    setForm({
      code: coupon.code,
      shopId: coupon.shopId,
      type: coupon.type,
      value: coupon.value,
      minOrderAmount: coupon.minOrderAmount ?? '',
      maxDiscount: coupon.maxDiscount ?? '',
      usageLimit: coupon.usageLimit?.toString() ?? '',
      perUserLimit: coupon.perUserLimit?.toString() ?? '',
      startsAt: toLocalInput(coupon.startsAt),
      expiresAt: toLocalInput(coupon.expiresAt),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function toggle(coupon: Coupon) {
    setError('');
    try {
      await apiRequest(`/vendor/coupons/${coupon.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !coupon.isActive }),
      }, true);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update coupon');
    }
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">Shop coupons</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Campaigns are restricted to shops you own and that an admin has approved.</p>

      {shops.length ? (
        <form onSubmit={submit} className="mt-4 grid gap-3 rounded-md border border-[var(--line)] bg-white p-4 md:grid-cols-4">
          <input className="h-10 rounded border border-[var(--line)] px-3" placeholder="SHOP10" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} required />
          <select className="h-10 rounded border border-[var(--line)] px-3" value={form.shopId} onChange={(event) => setForm({ ...form, shopId: event.target.value })} required>
            {shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
          </select>
          <select className="h-10 rounded border border-[var(--line)] px-3" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as Coupon['type'] })}>
            <option value="PERCENTAGE">Percentage</option><option value="FIXED_AMOUNT">Fixed amount</option>
          </select>
          <input className="h-10 rounded border border-[var(--line)] px-3" inputMode="decimal" placeholder="Discount value" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} required />
          <input className="h-10 rounded border border-[var(--line)] px-3" inputMode="decimal" placeholder="Minimum order" value={form.minOrderAmount} onChange={(event) => setForm({ ...form, minOrderAmount: event.target.value })} />
          <input className="h-10 rounded border border-[var(--line)] px-3" inputMode="decimal" placeholder="Maximum discount" value={form.maxDiscount} onChange={(event) => setForm({ ...form, maxDiscount: event.target.value })} />
          <input className="h-10 rounded border border-[var(--line)] px-3" type="number" min="1" placeholder="Total usage limit" value={form.usageLimit} onChange={(event) => setForm({ ...form, usageLimit: event.target.value })} />
          <input className="h-10 rounded border border-[var(--line)] px-3" type="number" min="1" placeholder="Per-customer limit" value={form.perUserLimit} onChange={(event) => setForm({ ...form, perUserLimit: event.target.value })} />
          <label className="text-xs text-[var(--muted)]">Starts at<input className="mt-1 h-10 w-full rounded border border-[var(--line)] px-3 text-sm text-black" type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></label>
          <label className="text-xs text-[var(--muted)]">Expires at<input className="mt-1 h-10 w-full rounded border border-[var(--line)] px-3 text-sm text-black" type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} /></label>
          <div className="flex items-end gap-2 md:col-span-2">
            <button disabled={saving} className="h-10 rounded bg-[var(--accent)] px-4 text-white disabled:opacity-60">{saving ? 'Saving…' : editingId ? 'Save coupon' : 'Create coupon'}</button>
            {editingId ? <button type="button" className="h-10 rounded border border-[var(--line)] px-4" onClick={() => { setEditingId(null); setForm({ ...EMPTY_FORM, shopId: shops[0]?.id || '' }); }}>Cancel</button> : null}
          </div>
        </form>
      ) : !loading ? <p className="mt-4 rounded border border-[var(--line)] bg-white p-4">An approved shop is required before creating coupons.</p> : null}

      {error ? <p className="mt-4 rounded bg-red-50 p-3 text-red-700">{error}</p> : null}
      {loading ? <p className="mt-4">Loading coupons…</p> : null}
      <div className="mt-4 grid gap-3">
        {coupons.map((coupon) => (
          <article key={coupon.id} className="rounded-md border border-[var(--line)] bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{coupon.code} · {coupon.shop.name}</h2>
                <p className="text-sm">{coupon.type === 'PERCENTAGE' ? `${coupon.value}%` : formatVnd(coupon.value)} · used {coupon.usedCount}/{coupon.usageLimit ?? '∞'} · per customer {coupon.perUserLimit ?? '∞'}</p>
                <p className="text-xs text-[var(--muted)]">{coupon.startsAt ? new Date(coupon.startsAt).toLocaleString() : 'Immediately'} → {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleString() : 'No expiry'}</p>
              </div>
              <div className="flex gap-2">
                <button className="rounded border border-[var(--line)] px-3 py-1.5 text-sm" onClick={() => edit(coupon)}>Edit</button>
                <button className="rounded border border-[var(--line)] px-3 py-1.5 text-sm" onClick={() => void toggle(coupon)}>{coupon.isActive ? 'Deactivate' : 'Activate'}</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}

function optionalText(value: string, editingId: string | null) {
  return value.trim() || (editingId ? null : undefined);
}

function optionalNumber(value: string, editingId: string | null) {
  return value ? Number(value) : editingId ? null : undefined;
}

function optionalDate(value: string, editingId: string | null) {
  return value ? new Date(value).toISOString() : editingId ? null : undefined;
}

function toLocalInput(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
