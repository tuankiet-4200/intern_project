'use client';

import { AppShell } from '@/components/AppShell';
import { apiRequest, clearSession, type SessionUser } from '@/lib/api';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Profile = SessionUser & { phone: string | null };
type Address = {
  id: string;
  recipient: string;
  phone: string;
  line1: string;
  ward: string;
  district: string;
  city: string;
  isDefault: boolean;
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [profileResult, addressResult] = await Promise.all([
        apiRequest<Profile>('/users/me', {}, true),
        apiRequest<Address[]>('/users/me/addresses', {}, true),
      ]);
      setProfile(profileResult);
      setAddresses(addressResult);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function createAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError('');
    try {
      await apiRequest('/users/me/addresses', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(form.entries())),
      }, true);
      event.currentTarget.reset();
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create address');
    }
  }

  async function makeDefault(addressId: string) {
    try {
      await apiRequest(`/users/me/addresses/${addressId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isDefault: true }),
      }, true);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update address');
    }
  }

  function signOut() {
    clearSession();
    router.push('/login');
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Profile & addresses</h1>
          <p className="text-sm text-[var(--muted)]">{profile ? `${profile.fullName} · ${profile.role}` : 'Authenticated customer settings'}</p>
        </div>
        <button className="rounded border border-[var(--line)] px-3 py-2" onClick={signOut}>Sign out</button>
      </div>
      {loading ? <p className="mt-4">Loading profile…</p> : null}
      {error ? <p className="mt-4 rounded bg-red-50 p-3 text-red-700">{error}</p> : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <section className="rounded-md border border-[var(--line)] bg-white p-4">
          <h2 className="font-semibold">Saved addresses</h2>
          <div className="mt-3 grid gap-3">
            {addresses.map((address) => (
              <article key={address.id} className="rounded border border-[var(--line)] p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{address.recipient} · {address.phone}</p>
                    <p className="mt-1 text-[var(--muted)]">{address.line1}, {address.ward}, {address.district}, {address.city}</p>
                  </div>
                  {address.isDefault ? <span className="rounded bg-[#e2f3f0] px-2 py-1 text-xs text-[var(--accent-strong)]">Default</span> : (
                    <button className="rounded border border-[var(--line)] px-2 py-1 text-xs" onClick={() => void makeDefault(address.id)}>Make default</button>
                  )}
                </div>
              </article>
            ))}
            {addresses.length === 0 && !loading ? <p className="text-sm text-[var(--muted)]">No saved addresses.</p> : null}
          </div>
        </section>

        <form className="grid content-start gap-3 rounded-md border border-[var(--line)] bg-white p-4" onSubmit={createAddress}>
          <h2 className="font-semibold">Add address</h2>
          {['recipient', 'phone', 'line1', 'ward', 'district', 'city'].map((field) => (
            <input key={field} name={field} className="h-10 rounded border border-[var(--line)] px-3" placeholder={field} required />
          ))}
          <button className="h-10 rounded bg-[var(--accent)] text-white">Save address</button>
        </form>
      </div>
    </AppShell>
  );
}
