import { AppShell } from '@/components/AppShell';

export default function VendorPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">Vendor operations</h1>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {['Product management', 'Inventory ledger', 'Shop orders'].map((item) => (
          <section key={item} className="rounded-md border border-[var(--line)] bg-white p-4">
            <h2 className="font-semibold">{item}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Phase 2/3 workflow placeholder.</p>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
