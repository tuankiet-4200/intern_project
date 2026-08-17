'use client';

import { AddressForm } from '@/components/AddressForm';
import { AppShell } from '@/components/AppShell';
import { apiRequest, clearSession, type SessionUser } from '@/lib/api';
import type { AddressDraft } from '@/lib/address';
import { Check, LogOut, MapPin, Phone, UserRound } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Profile = SessionUser & { phone: string | null; updatedAt: string };
type Address = AddressDraft & {
  id: string;
  isDefault: boolean;
};

const ROLE_LABEL: Record<SessionUser['role'], string> = {
  CUSTOMER: 'Khách hàng',
  VENDOR: 'Nhà bán hàng',
  ADMIN: 'Quản trị viên',
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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
      setError(requestError instanceof Error ? requestError.message : 'Không thể tải thông tin tài khoản.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function createAddress(address: AddressDraft) {
    setError('');
    setSuccess('');
    try {
      await apiRequest('/users/me/addresses', {
        method: 'POST',
        body: JSON.stringify(address),
      }, true);
      await load();
      setSuccess('Đã thêm địa chỉ mới.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể thêm địa chỉ.');
      throw requestError;
    }
  }

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError('');
    setSuccess('');
    try {
      await apiRequest('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: form.get('fullName'),
          phone: form.get('phone') || undefined,
        }),
      }, true);
      await load();
      setSuccess('Thông tin cá nhân đã được cập nhật.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể cập nhật thông tin cá nhân.');
    }
  }

  async function makeDefault(addressId: string) {
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/users/me/addresses/${addressId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isDefault: true }),
      }, true);
      await load();
      setSuccess('Đã đổi địa chỉ mặc định.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể cập nhật địa chỉ.');
    }
  }

  async function signOut() {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      clearSession();
      router.push('/login');
    }
  }

  return (
    <AppShell>
      <section className="rounded-[26px] bg-[#123b31] px-6 py-7 text-white shadow-[var(--shadow-md)] sm:flex sm:items-center sm:justify-between sm:px-8">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-300 text-[#123b31]"><UserRound size={26} /></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200/75">Tài khoản của tôi</p>
            <h1 className="mt-1 text-2xl font-extrabold">Hồ sơ và địa chỉ</h1>
            <p className="mt-1 text-sm text-emerald-50/70">{profile ? `${profile.fullName} · ${ROLE_LABEL[profile.role]}` : 'Quản lý thông tin giao nhận của bạn'}</p>
          </div>
        </div>
        <button className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold transition hover:bg-white/15 sm:mt-0" onClick={() => void signOut()}><LogOut size={17} /> Đăng xuất</button>
      </section>

      {loading ? <p className="mt-4 rounded-xl border border-[var(--line)] bg-white p-4">Đang tải hồ sơ…</p> : null}
      {error ? <p className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800"><Check size={16} /> {success}</p> : null}

      {profile ? (
        <section className="mt-5 rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]">
          <div>
            <h2 className="text-lg font-extrabold">Thông tin cá nhân</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Thông tin liên hệ dùng cho tài khoản và đơn hàng.</p>
          </div>
          <form key={profile.updatedAt} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]" onSubmit={updateProfile}>
            <label className="grid gap-1.5 text-sm"><span className="font-semibold">Họ và tên</span><input name="fullName" className="h-11 rounded-xl border border-[var(--line)] px-3.5" defaultValue={profile.fullName} placeholder="Nhập họ và tên" autoComplete="name" required /></label>
            <label className="grid gap-1.5 text-sm"><span className="font-semibold">Số điện thoại</span><input name="phone" className="h-11 rounded-xl border border-[var(--line)] px-3.5" defaultValue={profile.phone ?? ''} placeholder="Ví dụ: 0912 345 678" autoComplete="tel" /></label>
            <button className="button-primary self-end md:min-w-36">Cập nhật</button>
          </form>
        </section>
      ) : null}

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-emerald-50 p-2.5 text-[var(--accent)]"><MapPin size={19} /></span>
            <div><h2 className="text-lg font-extrabold">Địa chỉ đã lưu</h2><p className="text-sm text-[var(--muted)]">Chọn địa chỉ mặc định khi thanh toán.</p></div>
          </div>
          <div className="mt-4 grid gap-3">
            {addresses.map((address) => (
              <article key={address.id} className={`rounded-xl border p-4 text-sm ${address.isDefault ? 'border-emerald-300 bg-emerald-50/50' : 'border-[var(--line)]'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{address.recipient}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-[var(--muted)]"><Phone size={14} /> {address.phone}</p>
                    <p className="mt-2 leading-6 text-[var(--muted)]">{address.line1}, {address.ward}, {address.district}, {address.city}</p>
                  </div>
                  {address.isDefault ? <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">Mặc định</span> : (
                    <button type="button" className="shrink-0 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-xs font-bold transition hover:border-[var(--accent)] hover:text-[var(--accent)]" onClick={() => void makeDefault(address.id)}>Đặt mặc định</button>
                  )}
                </div>
              </article>
            ))}
            {addresses.length === 0 && !loading ? <p className="rounded-xl bg-gray-50 p-4 text-sm text-[var(--muted)]">Bạn chưa lưu địa chỉ nào.</p> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]">
          <h2 className="text-lg font-extrabold">Thêm địa chỉ mới</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Nhập thủ công hoặc dùng bản đồ để điền nhanh.</p>
          <div className="mt-4"><AddressForm onSubmit={createAddress} /></div>
        </section>
      </div>
    </AppShell>
  );
}
