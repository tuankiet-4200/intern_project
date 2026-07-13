import { AppShell } from '@/components/AppShell';

export default function AdminPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">Admin control</h1>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {['Shop review queue', 'Category governance', 'User moderation'].map((item) => (
          <section key={item} className="rounded-md border border-[var(--line)] bg-white p-4">
            <h2 className="font-semibold">{item}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Operational control placeholder.</p>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
