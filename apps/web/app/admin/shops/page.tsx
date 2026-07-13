import { Check, X } from 'lucide-react';
import { AppShell } from '@/components/AppShell';

const shops = [
  { name: 'North Studio', owner: 'vendor@example.com', status: 'PENDING_REVIEW' },
  { name: 'Bep Nha', owner: 'seller@example.com', status: 'PENDING_REVIEW' },
];

export default function AdminShopsPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">Shop review queue</h1>
      <div className="mt-4 grid gap-3">
        {shops.map((shop) => (
          <article key={shop.name} className="flex items-center justify-between rounded-md border border-[var(--line)] bg-white p-4">
            <div>
              <h2 className="font-semibold">{shop.name}</h2>
              <p className="text-sm text-[var(--muted)]">{shop.owner} · {shop.status}</p>
            </div>
            <div className="flex gap-2">
              <button className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--line)]" aria-label="Reject shop">
                <X size={16} />
              </button>
              <button className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--accent)] text-white" aria-label="Approve shop">
                <Check size={16} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
