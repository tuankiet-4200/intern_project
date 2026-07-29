'use client';

import { AppShell } from '@/components/AppShell';
import { apiRequest } from '@/lib/api';
import { Check, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type Shop = {
  id: string;
  name: string;
  status: string;
  owner: { email: string; fullName: string };
};

export default function AdminShopsPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setShops(await apiRequest<Shop[]>('/shops/admin/review-queue', {}, true));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load review queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function review(shopId: string, status: 'APPROVED' | 'REJECTED') {
    try {
      await apiRequest(`/shops/${shopId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }, true);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to review shop');
    }
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Shop review queue</h1>
          <p className="text-sm text-[var(--muted)]">Approve or reject pending vendor onboarding.</p>
        </div>
        <button className="flex h-10 items-center gap-2 rounded border border-[var(--line)] px-3" onClick={() => void load()}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>
      {loading ? <p className="mt-4 rounded-md border border-[var(--line)] bg-white p-4">Loading review queue…</p> : null}
      {error ? <p className="mt-4 rounded-md bg-red-50 p-3 text-red-700">{error}</p> : null}
      <div className="mt-4 grid gap-3">
        {shops.map((shop) => (
          <article key={shop.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--line)] bg-white p-4">
            <div>
              <h2 className="font-semibold">{shop.name}</h2>
              <p className="text-sm text-[var(--muted)]">{shop.owner.fullName} · {shop.owner.email} · {shop.status}</p>
            </div>
            <div className="flex gap-2">
              <button className="flex h-9 items-center gap-1 rounded-md border border-red-200 px-3 text-red-700" onClick={() => void review(shop.id, 'REJECTED')}>
                <X size={16} /> Reject
              </button>
              <button className="flex h-9 items-center gap-1 rounded-md bg-[var(--accent)] px-3 text-white" onClick={() => void review(shop.id, 'APPROVED')}>
                <Check size={16} /> Approve
              </button>
            </div>
          </article>
        ))}
        {!loading && !error && shops.length === 0 ? <p className="rounded-md border border-[var(--line)] bg-white p-4 text-[var(--muted)]">The review queue is empty.</p> : null}
      </div>
    </AppShell>
  );
}
