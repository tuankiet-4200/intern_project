'use client';

import { AppShell } from '@/components/AppShell';
import { apiRequest } from '@/lib/api';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type Shop = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
};

export default function VendorShopPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setShops(await apiRequest<Shop[]>('/shops/me', {}, true));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load shops');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await apiRequest('/shops', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          slug: form.get('slug'),
          description: form.get('description') || undefined,
        }),
      }, true);
      event.currentTarget.reset();
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create shop request');
    }
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">Shop onboarding</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">New shops require admin approval before products can be activated.</p>

      {error ? <p className="mt-4 rounded bg-red-50 p-3 text-red-700">{error}</p> : null}
      {loading ? <p className="mt-4">Loading your shops…</p> : null}
      <div className="mt-4 grid gap-3">
        {shops.map((shop) => (
          <article key={shop.id} className="rounded border border-[var(--line)] bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{shop.name}</h2>
                <p className="text-sm text-[var(--muted)]">{shop.slug} · {shop.status}</p>
              </div>
              {shop.status === 'APPROVED' ? <Link href="/vendor/products" className="rounded bg-[var(--accent)] px-3 py-2 text-sm text-white">Manage products</Link> : null}
            </div>
          </article>
        ))}
      </div>

      <form className="mt-4 grid gap-3 rounded border border-[var(--line)] bg-white p-4 md:grid-cols-2" onSubmit={create}>
        <h2 className="font-semibold md:col-span-2">Request a new shop</h2>
        <input name="name" className="h-10 rounded border border-[var(--line)] px-3" placeholder="Shop name" required minLength={3} />
        <input name="slug" className="h-10 rounded border border-[var(--line)] px-3" placeholder="shop-slug" required minLength={3} />
        <textarea name="description" className="min-h-24 rounded border border-[var(--line)] p-3 md:col-span-2" placeholder="What does your shop sell?" />
        <button className="h-10 rounded bg-[var(--accent)] text-white md:w-fit md:px-4">Submit for review</button>
      </form>
    </AppShell>
  );
}
