'use client';

import { AppShell, Metric } from '@/components/AppShell';
import { apiRequest, formatVnd } from '@/lib/api';
import { BarChart3, PackageCheck, ShieldCheck, ShoppingBag } from 'lucide-react';
import { useEffect, useState } from 'react';

type Product = {
  id: string;
  name: string;
  price: string;
  shop: { name: string };
  inventory: { onHand: number; reserved: number };
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<{ items: Product[] }>('/products')
      .then((result) => setProducts(result.items))
      .catch((requestError: unknown) => {
        setError(requestError instanceof Error ? requestError.message : 'Unable to load products');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <section className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold">Product catalog</h1>
              <p className="mt-1 text-[var(--muted)]">Live active products from approved shops with available stock.</p>
            </div>
          </div>

          {loading ? <p className="rounded-md border border-[var(--line)] bg-white p-4">Loading catalog…</p> : null}
          {error ? <p className="rounded-md bg-red-50 p-4 text-red-700">{error}</p> : null}
          {!loading && !error && products.length === 0 ? (
            <p className="rounded-md border border-[var(--line)] bg-white p-4 text-[var(--muted)]">No products are available.</p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            {products.map((product) => {
              const available = product.inventory.onHand - product.inventory.reserved;
              return (
                <article key={product.id} className="rounded-md border border-[var(--line)] bg-white p-4">
                  <div className="mb-4 aspect-[5/3] rounded-md bg-[#e8ece6]" />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{product.name}</h2>
                      <p className="text-sm text-[var(--muted)]">{product.shop.name}</p>
                    </div>
                    <span className="text-sm font-semibold">{formatVnd(product.price)}</span>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-[var(--muted)]">Available: {available}</span>
                    <button className="rounded-md border border-[var(--line)] px-3 py-2" disabled title="Cart starts in Phase 3">
                      Cart in Phase 3
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
        <aside className="grid content-start gap-3">
          <Metric label="Available products" value={String(products.length)} icon={ShoppingBag} />
          <Metric label="Catalog source" value={error ? 'Offline' : 'Live API'} icon={ShieldCheck} />
          <Metric label="Cart workflow" value="Phase 3" icon={PackageCheck} />
          <Metric label="API state" value={loading ? 'Loading' : error ? 'Error' : 'Ready'} icon={BarChart3} />
        </aside>
      </section>
    </AppShell>
  );
}
