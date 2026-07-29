'use client';

import { AppShell } from '@/components/AppShell';
import { apiRequest, saveSession, type SessionUser } from '@/lib/api';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const session = await apiRequest<{ accessToken: string; user: SessionUser }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: form.get('email'),
          password: form.get('password'),
          fullName: form.get('fullName'),
          phone: form.get('phone') || undefined,
        }),
      });
      saveSession(session);
      router.push('/vendor/shop');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to register');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <section className="mx-auto max-w-md rounded-md border border-[var(--line)] bg-white p-5">
        <h1 className="text-2xl font-semibold">Create customer account</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">You can request a vendor shop after registration.</p>
        <form className="mt-5 grid gap-3" onSubmit={submit}>
          <input name="fullName" className="h-11 rounded border border-[var(--line)] px-3" placeholder="Full name" required minLength={2} />
          <input name="email" className="h-11 rounded border border-[var(--line)] px-3" type="email" placeholder="you@example.com" required />
          <input name="phone" className="h-11 rounded border border-[var(--line)] px-3" placeholder="Phone (optional)" />
          <input name="password" className="h-11 rounded border border-[var(--line)] px-3" type="password" placeholder="Password (8+ characters)" required minLength={8} />
          {error ? <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <button className="h-11 rounded bg-[var(--accent)] text-white disabled:opacity-60" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="mt-4 text-sm text-[var(--muted)]">Already registered? <Link href="/login" className="font-medium text-[var(--accent)]">Sign in</Link></p>
      </section>
    </AppShell>
  );
}
