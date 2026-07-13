import { BarChart3, PackageCheck, ShieldCheck, ShoppingBag } from 'lucide-react';
import { AppShell, Metric } from '@/components/AppShell';

const products = [
  { name: 'Everyday Cotton Shirt', shop: 'North Studio', price: '329.000 VND', stock: 42 },
  { name: 'Modular Desk Lamp', shop: 'Workwell', price: '590.000 VND', stock: 18 },
  { name: 'Ceramic Lunch Bowl', shop: 'Bep Nha', price: '210.000 VND', stock: 64 },
  { name: 'Travel Tech Pouch', shop: 'Carry Lab', price: '420.000 VND', stock: 23 },
];

export default function Home() {
  return (
    <AppShell>
      <section className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold">Commerce workspace</h1>
              <p className="mt-1 text-[var(--muted)]">Customer buying flow, vendor operations and admin control in one clean foundation.</p>
            </div>
            <button className="h-10 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white">New checkout</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {products.map((product) => (
              <article key={product.name} className="rounded-md border border-[var(--line)] bg-white p-4">
                <div className="mb-4 aspect-[5/3] rounded-md bg-[#e8ece6]" />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{product.name}</h2>
                    <p className="text-sm text-[var(--muted)]">{product.shop}</p>
                  </div>
                  <span className="text-sm font-semibold">{product.price}</span>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-[var(--muted)]">Available: {product.stock}</span>
                  <button className="rounded-md border border-[var(--line)] px-3 py-2">Add</button>
                </div>
              </article>
            ))}
          </div>
        </div>
        <aside className="grid content-start gap-3">
          <Metric label="Approved shops" value="12" icon={ShieldCheck} />
          <Metric label="Active products" value="248" icon={ShoppingBag} />
          <Metric label="Orders this week" value="86" icon={PackageCheck} />
          <Metric label="Ops health" value="Good" icon={BarChart3} />
        </aside>
      </section>
    </AppShell>
  );
}
