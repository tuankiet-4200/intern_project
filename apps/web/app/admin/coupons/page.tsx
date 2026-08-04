'use client';

import { AppShell } from '@/components/AppShell';
import { apiRequest, formatVnd } from '@/lib/api';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type Shop = { id: string; name: string; slug: string };
type Coupon = {
  id: string;
  code: string;
  scope: 'GLOBAL' | 'SHOP';
  shopId: string | null;
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
  shop: Shop | null;
  _count: { usages: number };
};
type CouponPage = { data: Coupon[]; total: number; page: number; limit: number };
type FormState = {
  code: string;
  scope: Coupon['scope'];
  shopId: string;
  type: Coupon['type'];
  value: string;
  minOrderAmount: string;
  maxDiscount: string;
  usageLimit: string;
  perUserLimit: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  code: '', scope: 'GLOBAL', shopId: '', type: 'PERCENTAGE', value: '',
  minOrderAmount: '', maxDiscount: '', usageLimit: '', perUserLimit: '',
  startsAt: '', expiresAt: '', isActive: true,
};

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const selectableShops = useMemo(() => {
    const byId = new Map(shops.map((shop) => [shop.id, shop]));
    for (const coupon of coupons) if (coupon.shop) byId.set(coupon.shop.id, coupon.shop);
    return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [coupons, shops]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [campaigns, approvedShops] = await Promise.all([
        apiRequest<CouponPage>('/admin/coupons?limit=100', {}, true),
        apiRequest<Shop[]>('/shops'),
      ]);
      setCoupons(campaigns.data);
      setShops(approvedShops);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load coupon campaigns');
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
    const payload = {
      code: form.code,
      scope: form.scope,
      shopId: form.scope === 'SHOP' ? form.shopId : editingId ? null : undefined,
      type: form.type,
      value: form.value,
      minOrderAmount: optionalValue(form.minOrderAmount, editingId),
      maxDiscount: optionalValue(form.maxDiscount, editingId),
      usageLimit: optionalNumber(form.usageLimit, editingId),
      perUserLimit: optionalNumber(form.perUserLimit, editingId),
      startsAt: optionalDate(form.startsAt, editingId),
      expiresAt: optionalDate(form.expiresAt, editingId),
      ...(editingId ? {} : { isActive: form.isActive }),
    };
    try {
      await apiRequest(editingId ? `/admin/coupons/${editingId}` : '/admin/coupons', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      }, true);
      resetForm();
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save coupon campaign');
    } finally {
      setSaving(false);
    }
  }

  function edit(coupon: Coupon) {
    setEditingId(coupon.id);
    setForm({
      code: coupon.code,
      scope: coupon.scope,
      shopId: coupon.shopId ?? '',
      type: coupon.type,
      value: coupon.value,
      minOrderAmount: coupon.minOrderAmount ?? '',
      maxDiscount: coupon.maxDiscount ?? '',
      usageLimit: coupon.usageLimit?.toString() ?? '',
      perUserLimit: coupon.perUserLimit?.toString() ?? '',
      startsAt: toLocalInput(coupon.startsAt),
      expiresAt: toLocalInput(coupon.expiresAt),
      isActive: coupon.isActive,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function toggle(coupon: Coupon) {
    setError('');
    try {
      await apiRequest(`/admin/coupons/${coupon.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !coupon.isActive }),
      }, true);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update coupon status');
    }
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">Coupon campaigns</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Manage global/shop discounts and protect total and per-customer usage.</p>

      <form onSubmit={submit} className="mt-4 grid gap-3 rounded-md border border-[var(--line)] bg-white p-4 md:grid-cols-4">
        <input className="h-10 rounded border border-[var(--line)] px-3" placeholder="WELCOME10" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} required />
        <select className="h-10 rounded border border-[var(--line)] px-3" value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value as Coupon['scope'], shopId: '' })}>
          <option value="GLOBAL">Global</option><option value="SHOP">Shop</option>
        </select>
        <select className="h-10 rounded border border-[var(--line)] px-3 disabled:bg-gray-100" value={form.shopId} disabled={form.scope === 'GLOBAL'} onChange={(event) => setForm({ ...form, shopId: event.target.value })} required={form.scope === 'SHOP'}>
          <option value="">Select approved shop</option>
          {selectableShops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
        </select>
        <select className="h-10 rounded border border-[var(--line)] px-3" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as Coupon['type'] })}>
          <option value="PERCENTAGE">Percentage</option><option value="FIXED_AMOUNT">Fixed amount</option>
        </select>
        <input className="h-10 rounded border border-[var(--line)] px-3" inputMode="decimal" placeholder={form.type === 'PERCENTAGE' ? 'Value %' : 'Value VND'} value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} required />
        <input className="h-10 rounded border border-[var(--line)] px-3" inputMode="decimal" placeholder="Minimum order (optional)" value={form.minOrderAmount} onChange={(event) => setForm({ ...form, minOrderAmount: event.target.value })} />
        <input className="h-10 rounded border border-[var(--line)] px-3" inputMode="decimal" placeholder="Maximum discount (optional)" value={form.maxDiscount} onChange={(event) => setForm({ ...form, maxDiscount: event.target.value })} />
        <input className="h-10 rounded border border-[var(--line)] px-3" type="number" min="1" placeholder="Total usage limit" value={form.usageLimit} onChange={(event) => setForm({ ...form, usageLimit: event.target.value })} />
        <input className="h-10 rounded border border-[var(--line)] px-3" type="number" min="1" placeholder="Per-customer limit" value={form.perUserLimit} onChange={(event) => setForm({ ...form, perUserLimit: event.target.value })} />
        <label className="text-xs text-[var(--muted)]">Starts at<input className="mt-1 h-10 w-full rounded border border-[var(--line)] px-3 text-sm text-black" type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></label>
        <label className="text-xs text-[var(--muted)]">Expires at<input className="mt-1 h-10 w-full rounded border border-[var(--line)] px-3 text-sm text-black" type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} /></label>
        {!editingId ? <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Active immediately</label> : <span />}
        <div className="flex gap-2 md:col-span-4">
          <button disabled={saving} className="h-10 rounded bg-[var(--accent)] px-4 text-white disabled:opacity-60">{saving ? 'Saving…' : editingId ? 'Save campaign' : 'Create campaign'}</button>
          {editingId ? <button type="button" className="h-10 rounded border border-[var(--line)] px-4" onClick={resetForm}>Cancel edit</button> : null}
        </div>
      </form>

      {error ? <p className="mt-4 rounded bg-red-50 p-3 text-red-700">{error}</p> : null}
      {loading ? <p className="mt-4">Loading campaigns…</p> : null}
      {!loading && coupons.length === 0 ? <p className="mt-4 rounded border border-[var(--line)] bg-white p-4 text-[var(--muted)]">No coupon campaigns yet.</p> : null}
      <div className="mt-4 grid gap-3">
        {coupons.map((coupon) => (
          <article key={coupon.id} className="rounded-md border border-[var(--line)] bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{coupon.code} <span className="text-xs font-normal text-[var(--muted)]">{coupon.scope}{coupon.shop ? ` · ${coupon.shop.name}` : ''}</span></h2>
                <p className="mt-1 text-sm">{coupon.type === 'PERCENTAGE' ? `${coupon.value}%` : formatVnd(coupon.value)} · used {coupon.usedCount}/{coupon.usageLimit ?? '∞'} · per customer {coupon.perUserLimit ?? '∞'}</p>
                <p className="text-xs text-[var(--muted)]">Minimum {coupon.minOrderAmount ? formatVnd(coupon.minOrderAmount) : 'none'} · cap {coupon.maxDiscount ? formatVnd(coupon.maxDiscount) : 'none'} · {coupon.startsAt ? new Date(coupon.startsAt).toLocaleString() : 'starts immediately'} → {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleString() : 'no expiry'}</p>
              </div>
              <div className="flex gap-2">
                <button className="rounded border border-[var(--line)] px-3 py-1.5 text-sm" onClick={() => edit(coupon)}>Edit</button>
                <button className="rounded border border-[var(--line)] px-3 py-1.5 text-sm" onClick={() => void toggle(coupon)}>{coupon.isActive ? 'Deactivate' : 'Activate'}</button>
              </div>
            </div>
            <p className={`mt-2 text-xs font-medium ${coupon.isActive ? 'text-green-700' : 'text-gray-500'}`}>{coupon.isActive ? 'ACTIVE' : 'INACTIVE'} · {coupon._count.usages} usage records</p>
          </article>
        ))}
      </div>
    </AppShell>
  );
}

function optionalValue(value: string, editingId: string | null) {
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
