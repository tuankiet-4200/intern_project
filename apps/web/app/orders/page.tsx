import { AppShell } from '@/components/AppShell';

export default function OrdersPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">Orders</h1>
      <div className="mt-4 overflow-hidden rounded-md border border-[var(--line)] bg-white">
        {['Placed', 'Confirmed', 'Packing', 'Delivered'].map((status) => (
          <div key={status} className="flex items-center justify-between border-b border-[var(--line)] p-4 last:border-b-0">
            <span>{status}</span>
            <span className="text-sm text-[var(--muted)]">Status lane</span>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
