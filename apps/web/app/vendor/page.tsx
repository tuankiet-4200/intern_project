import { AppShell } from '@/components/AppShell';
import Link from 'next/link';

export default function VendorPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">Vendor operations</h1>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Link href="/vendor/shop" className="rounded-md border border-[var(--line)] bg-white p-4">
          <h2 className="font-semibold">Shop onboarding</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Request a shop and track approval.</p>
        </Link>
        <Link href="/vendor/products" className="rounded-md border border-[var(--line)] bg-white p-4">
          <h2 className="font-semibold">Product management</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Create, edit, activate and archive products.</p>
        </Link>
        <Link href="/vendor/orders" className="rounded-md border border-[var(--line)] bg-white p-4">
          <h2 className="font-semibold">Shop orders</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Confirm, pack, hand off or cancel incoming orders.</p>
        </Link>
        <Link href="/vendor/coupons" className="rounded-md border border-[var(--line)] bg-white p-4">
          <h2 className="font-semibold">Shop coupons</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Create and manage campaigns for approved shops.</p>
        </Link>
      </div>
    </AppShell>
  );
}
