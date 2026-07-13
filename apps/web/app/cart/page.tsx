import { AppShell } from '@/components/AppShell';

export default function CartPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">Cart</h1>
      <div className="mt-4 rounded-md border border-[var(--line)] bg-white p-5">
        <p className="text-[var(--muted)]">Phase 2 will connect cart items to the API and validate stock before checkout.</p>
      </div>
    </AppShell>
  );
}
