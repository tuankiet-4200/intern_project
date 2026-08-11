'use client';

import { AppShell } from '@/components/AppShell';
import { apiRequest, saveSession, type SessionUser } from '@/lib/api';
import { ArrowRight, CheckCircle2, Store } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

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
      router.push('/');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể tạo tài khoản. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="grid min-h-[calc(100vh-72px)] bg-white lg:grid-cols-[1.05fr_0.95fr]">
        <section className="flex items-center justify-center bg-[var(--background)] px-5 py-12 sm:px-10">
          <div className="w-full max-w-lg">
            <p className="eyebrow">Tạo tài khoản khách hàng</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] sm:text-4xl">Bắt đầu mua sắm chỉ trong một phút.</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Tài khoản mới được tạo với vai trò Customer. Bạn có thể đăng ký mở cửa hàng sau.</p>

            <form className="surface-card mt-6 grid gap-4 p-5 sm:grid-cols-2 sm:p-7" onSubmit={submit}>
              <label className="grid gap-2 text-sm font-bold sm:col-span-2">Họ và tên<input name="fullName" className="h-12 rounded-xl border px-3.5 font-normal" placeholder="Nguyễn Văn An" required minLength={2} autoComplete="name" /></label>
              <label className="grid gap-2 text-sm font-bold sm:col-span-2">Email<input name="email" className="h-12 rounded-xl border px-3.5 font-normal" type="email" placeholder="ban@example.com" required autoComplete="email" /></label>
              <label className="grid gap-2 text-sm font-bold">Số điện thoại <span className="font-normal text-[var(--muted)]">(không bắt buộc)</span><input name="phone" className="h-12 rounded-xl border px-3.5 font-normal" placeholder="09xxxxxxxx" autoComplete="tel" /></label>
              <label className="grid gap-2 text-sm font-bold">Mật khẩu<input name="password" className="h-12 rounded-xl border px-3.5 font-normal" type="password" placeholder="Tối thiểu 8 ký tự" required minLength={8} autoComplete="new-password" /></label>
              {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{error}</p> : null}
              <button className="button-primary h-12 sm:col-span-2" disabled={submitting}>{submitting ? 'Đang tạo tài khoản…' : <><span>Tạo tài khoản</span><ArrowRight size={17} /></>}</button>
            </form>
            <p className="mt-5 text-center text-sm text-[var(--muted)]">Đã có tài khoản? <Link href="/login" className="font-bold text-[var(--accent)]">Đăng nhập</Link></p>
          </div>
        </section>

        <aside className="relative hidden overflow-hidden bg-[#123b31] px-12 py-14 text-white lg:flex lg:flex-col lg:justify-center">
          <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-emerald-300/10 blur-3xl" />
          <div className="relative z-10 max-w-md">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-300 text-[#123b31]"><Store size={26} /></span>
            <h2 className="mt-7 text-4xl font-black leading-tight tracking-[-0.04em]">Muốn bán hàng trên Intern Market?</h2>
            <p className="mt-4 leading-7 text-emerald-50/65">Sau khi đăng ký, truy cập Kênh người bán để gửi hồ sơ cửa hàng. Admin sẽ kiểm duyệt trước khi sản phẩm được mở bán.</p>
            <div className="mt-7 grid gap-3">
              {['Tài khoản Customer được tạo an toàn', 'Hồ sơ cửa hàng có trạng thái rõ ràng', 'Workspace Vendor mở sau khi được duyệt'].map((item) => <p key={item} className="flex items-center gap-3 text-sm font-semibold"><CheckCircle2 className="text-emerald-300" size={19} /> {item}</p>)}
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
