import { AppShell } from '@/components/AppShell';

export default function LoginPage() {
  return (
    <AppShell>
      <section className="mx-auto max-w-md rounded-md border border-[var(--line)] bg-white p-5">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <form className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm">
            Email
            <input className="h-11 rounded-md border border-[var(--line)] px-3" type="email" placeholder="you@example.com" />
          </label>
          <label className="grid gap-2 text-sm">
            Password
            <input className="h-11 rounded-md border border-[var(--line)] px-3" type="password" placeholder="••••••••" />
          </label>
          <button className="h-11 rounded-md bg-[var(--accent)] font-medium text-white">Sign in</button>
        </form>
      </section>
    </AppShell>
  );
}
