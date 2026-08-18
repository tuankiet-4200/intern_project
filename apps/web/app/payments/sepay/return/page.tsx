'use client';

import { AppShell } from '@/components/AppShell';
import { apiRequest } from '@/lib/api';
import { CheckCircle2, Clock3, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

type ReconcileResult = { paymentId: string; paymentStatus: string; alreadySettled?: boolean };

export default function SepayReturnPage() {
  return <Suspense fallback={<AppShell><p className="surface-card p-5">Đang kiểm tra thanh toán…</p></AppShell>}><SepayReturnContent /></Suspense>;
}

function SepayReturnContent() {
  const searchParams = useSearchParams();
  const callbackStatus = searchParams.get('status');
  const paymentId = searchParams.get('payment_id');
  const [state, setState] = useState<'checking' | 'paid' | 'pending' | 'cancelled'>(
    callbackStatus === 'cancel' || callbackStatus === 'error'
      ? 'cancelled'
      : callbackStatus === 'success' && paymentId
        ? 'checking'
        : 'pending',
  );
  const [message, setMessage] = useState(
    callbackStatus === 'cancel'
      ? 'Bạn đã hủy phiên thanh toán.'
      : callbackStatus === 'error'
        ? 'SePay không thể hoàn tất phiên thanh toán.'
        : callbackStatus === 'success' && !paymentId
          ? 'Thiếu mã giao dịch để đối soát. Vui lòng kiểm tra trong Đơn mua.'
          : callbackStatus === 'success'
            ? ''
            : 'Liên kết trả về không hợp lệ. Vui lòng kiểm tra trạng thái trong Đơn mua.',
  );

  useEffect(() => {
    if (callbackStatus !== 'success') return;
    if (!paymentId) return;
    let active = true;
    void apiRequest<ReconcileResult>(`/payments/sepay/${paymentId}/reconcile`, { method: 'POST' }, true)
      .then((result) => {
        if (!active) return;
        if (result.paymentStatus === 'PAID') {
          setState('paid');
          setMessage('SePay đã xác nhận thanh toán thành công.');
        } else {
          setState('pending');
          setMessage('Giao dịch đang chờ SePay xác nhận.');
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState('pending');
        setMessage(error instanceof Error ? error.message : 'Chưa thể đối soát giao dịch lúc này.');
      });
    return () => { active = false; };
  }, [callbackStatus, paymentId]);

  const Icon = state === 'paid' ? CheckCircle2 : state === 'cancelled' ? XCircle : Clock3;
  return (
    <section className="mx-auto max-w-xl rounded-3xl border border-[var(--line)] bg-white p-8 text-center shadow-[var(--shadow-md)]">
      <Icon className={`mx-auto ${state === 'paid' ? 'text-emerald-600' : state === 'cancelled' ? 'text-red-500' : 'text-amber-500'}`} size={48} />
      <h1 className="mt-4 text-2xl font-black">{state === 'paid' ? 'Thanh toán thành công' : state === 'cancelled' ? 'Thanh toán chưa hoàn tất' : 'Đang đối soát thanh toán'}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{message || 'Vui lòng chờ trong giây lát…'}</p>
      <p className="mt-3 text-xs text-[var(--muted)]">Trạng thái chỉ được ghi nhận sau khi máy chủ xác minh trực tiếp với SePay.</p>
      <Link href="/orders" className="button-primary mt-6 inline-flex">Xem đơn mua</Link>
    </section>
  );
}
