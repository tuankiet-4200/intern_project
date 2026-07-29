'use client';

import { AppShell } from '@/components/AppShell';
import { apiRequest, saveSession, type SessionUser } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FormEvent, useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('vendor@example.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const session = await apiRequest<{ accessToken: string; user: SessionUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      saveSession(session);
      router.push(session.user.role === 'ADMIN' ? '/admin/shops' : session.user.role === 'VENDOR' ? '/vendor/products' : '/');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <section className="mx-auto max-w-md rounded-md border border-[var(--line)] bg-white p-5">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Demo accounts use password <code>password123</code>.</p>
        <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm">
            Email
            <input className="h-11 rounded-md border border-[var(--line)] px-3" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="grid gap-2 text-sm">
            Password
            <input className="h-11 rounded-md border border-[var(--line)] px-3" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <button className="h-11 rounded-md bg-[var(--accent)] font-medium text-white disabled:opacity-60" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {['admin', 'vendor', 'customer'].map((role) => (
            <button key={role} type="button" className="rounded border border-[var(--line)] px-2 py-1" onClick={() => setEmail(`${role}@example.com`)}>
              Use {role}
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm text-[var(--muted)]">New customer? <Link href="/register" className="font-medium text-[var(--accent)]">Create an account</Link></p>
      </section>
    </AppShell>
  );
}
