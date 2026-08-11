'use client';

import { AppShell } from '@/components/AppShell';
import { apiRequest, saveSession, type SessionUser } from '@/lib/api';
import { ArrowRight, LockKeyhole, ShieldCheck, ShoppingBag, Store, UserCog } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

const DEMO_ACCOUNTS = [
  { role: 'Khách hàng', email: 'customer@example.com', icon: ShoppingBag, hint: 'Mua sắm và theo dõi đơn' },
  { role: 'Nhà bán', email: 'vendor@example.com', icon: Store, hint: 'Quản lý gian hàng' },
  { role: 'Quản trị', email: 'admin@example.com', icon: UserCog, hint: 'Vận hành nền tảng' },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('customer@example.com');
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
      router.push(session.user.role === 'ADMIN' ? '/admin' : session.user.role === 'VENDOR' ? '/vendor' : '/');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể đăng nhập. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="grid min-h-[calc(100vh-72px)] bg-white lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="relative hidden overflow-hidden bg-[#123b31] px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-emerald-300/10 blur-3xl" />
          <div className="relative z-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-emerald-100"><ShieldCheck size={14} /> Một tài khoản, đúng workspace</span>
            <h1 className="mt-7 max-w-lg text-5xl font-black leading-[1.08] tracking-[-0.045em]">Chào mừng bạn quay trở lại.</h1>
            <p className="mt-5 max-w-md text-base leading-7 text-emerald-50/65">Hệ thống tự nhận diện vai trò và đưa bạn đến đúng không gian làm việc dành cho Customer, Vendor hoặc Admin.</p>
          </div>
          <div className="relative z-10 grid gap-3">
            {DEMO_ACCOUNTS.map(({ role, hint, icon: Icon }) => (
              <div key={role} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-300 text-[#123b31]"><Icon size={19} /></span>
                <div><p className="text-sm font-bold">{role}</p><p className="mt-0.5 text-xs text-white/50">{hint}</p></div>
              </div>
            ))}
          </div>
        </aside>

        <section className="flex items-center justify-center bg-[var(--background)] px-5 py-12 sm:px-10">
          <div className="w-full max-w-md">
            <p className="eyebrow">Đăng nhập tài khoản</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.035em]">Tiếp tục với Intern Market</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Chọn nhanh tài khoản demo hoặc nhập thông tin của bạn.</p>

            <div className="mt-6 grid grid-cols-3 gap-2">
              {DEMO_ACCOUNTS.map(({ role, email: accountEmail, icon: Icon }) => (
                <button
                  key={role}
                  type="button"
                  className={`rounded-xl border p-3 text-left transition ${email === accountEmail ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]' : 'border-[var(--line)] bg-white hover:border-[#b7c9c0]'}`}
                  onClick={() => setEmail(accountEmail)}
                >
                  <Icon size={18} /><span className="mt-2 block text-xs font-extrabold">{role}</span>
                </button>
              ))}
            </div>

            <form className="surface-card mt-4 grid gap-4 p-5 sm:p-6" onSubmit={handleSubmit}>
              <label className="grid gap-2 text-sm font-bold">
                Email
                <input className="h-12 rounded-xl border px-3.5 font-normal" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
              </label>
              <label className="grid gap-2 text-sm font-bold">
                Mật khẩu
                <div className="relative">
                  <LockKeyhole className="absolute left-3.5 top-3.5 text-[var(--muted)]" size={18} />
                  <input className="h-12 w-full rounded-xl border py-2 pl-11 pr-3.5 font-normal" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
                </div>
              </label>
              <p className="rounded-xl bg-[#f3f6f4] px-3 py-2.5 text-xs text-[var(--muted)]">Mật khẩu demo: <code className="font-bold text-[var(--foreground)]">password123</code></p>
              {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
              <button className="button-primary h-12 w-full" disabled={submitting}>
                {submitting ? 'Đang đăng nhập…' : <><span>Đăng nhập</span><ArrowRight size={17} /></>}
              </button>
            </form>
            <p className="mt-5 text-center text-sm text-[var(--muted)]">Chưa có tài khoản? <Link href="/register" className="font-bold text-[var(--accent)]">Đăng ký miễn phí</Link></p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
