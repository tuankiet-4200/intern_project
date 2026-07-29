import { AppShell } from '@/components/AppShell';
import Link from 'next/link';

export default function AdminPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">Admin control</h1>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Link href="/admin/shops" className="rounded-md border border-[var(--line)] bg-white p-4">
          <h2 className="font-semibold">Shop review queue</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Approve or reject pending shops.</p>
        </Link>
        <Link href="/admin/categories" className="rounded-md border border-[var(--line)] bg-white p-4">
          <h2 className="font-semibold">Category governance</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Manage category hierarchy and status.</p>
        </Link>
        <section className="rounded-md border border-[var(--line)] bg-white p-4">
          <h2 className="font-semibold">User moderation</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Planned after the Phase 2 customer profile workflow.</p>
        </section>
      </div>
    </AppShell>
  );
}
