'use client';

import { AppShell } from '@/components/AppShell';
import { apiRequest, formatVnd } from '@/lib/api';
import { FormEvent, useCallback, useEffect, useState } from 'react';

type Refund = {
  id: string;
  amount: string;
  status: string;
  reason: string | null;
  failureReason: string | null;
  refundedAt: string | null;
  createdAt: string;
};
type Payment = {
  id: string;
  method: 'COD' | 'BANK_TRANSFER' | 'SEPAY';
  status: string;
  amount: string;
  createdAt: string;
  parentOrder: {
    id: string;
    orderNumber: string;
    totalAmount: string;
    user: { email: string; fullName: string };
  };
  refunds: Refund[];
};
type PaymentPage = { data: Payment[]; total: number; page: number; limit: number };

export default function AdminRefundsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentId, setPaymentId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [confirmOffline, setConfirmOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const selected = payments.find((payment) => payment.id === paymentId);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest<PaymentPage>('/payments?limit=100', {}, true);
      setPayments(result.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load payments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      await apiRequest(`/payments/${selected.id}/refunds`, {
        method: 'POST',
        body: JSON.stringify({
          amount,
          reason: reason.trim() || undefined,
          idempotencyKey: `admin-refund-${crypto.randomUUID()}`,
          confirmOfflineRefund: selected.method === 'COD' ? confirmOffline : undefined,
        }),
      }, true);
      setAmount('');
      setReason('');
      setConfirmOffline(false);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create refund');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">Refund operations</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Create audited partial/full refunds and inspect their status history.</p>

      <form onSubmit={submit} className="mt-4 grid gap-3 rounded-md border border-[var(--line)] bg-white p-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm md:col-span-2">Payment
          <select className="h-10 rounded border border-[var(--line)] px-3" value={paymentId} onChange={(event) => { setPaymentId(event.target.value); setConfirmOffline(false); }} required>
            <option value="">Select a paid/refundable payment</option>
            {payments.filter((payment) => payment.method !== 'SEPAY' && ['PAID', 'PARTIALLY_REFUNDED'].includes(payment.status)).map((payment) => (
              <option key={payment.id} value={payment.id}>
                {payment.parentOrder.orderNumber} · {payment.parentOrder.user.email} · {payment.method} · {formatVnd(payment.amount)} · {payment.status}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-[var(--muted)] md:col-span-2">Hoàn tiền tự động cho SePay chưa được hỗ trợ; giao dịch SePay vẫn hiển thị bên dưới để đối soát nhưng không xuất hiện trong danh sách tạo refund.</p>
        <input className="h-10 rounded border border-[var(--line)] px-3" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Refund amount" required />
        <input className="h-10 rounded border border-[var(--line)] px-3" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Reason / support ticket" />
        {selected?.method === 'COD' ? (
          <label className="flex items-center gap-2 rounded bg-amber-50 p-3 text-sm md:col-span-2">
            <input type="checkbox" checked={confirmOffline} onChange={(event) => setConfirmOffline(event.target.checked)} required />
            I confirm cash was already returned offline. This records the COD refund as immediately successful.
          </label>
        ) : selected ? (
          <p className="rounded bg-blue-50 p-3 text-sm text-blue-800 md:col-span-2">Bank-transfer refund remains PENDING until the signed provider callback settles it.</p>
        ) : null}
        <button disabled={saving || !selected} className="h-10 justify-self-start rounded bg-[var(--accent)] px-4 text-white disabled:opacity-60">
          {saving ? 'Creating…' : 'Create refund'}
        </button>
      </form>

      {error ? <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="mt-4">Loading payments…</p> : null}
      <div className="mt-4 grid gap-3">
        {payments.map((payment) => (
          <article key={payment.id} className="rounded-md border border-[var(--line)] bg-white p-4">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h2 className="font-semibold">{payment.parentOrder.orderNumber}</h2>
                <p className="text-sm text-[var(--muted)]">{payment.parentOrder.user.fullName} · {payment.parentOrder.user.email}</p>
              </div>
              <p className="text-right text-sm"><strong>{formatVnd(payment.amount)}</strong><br />{payment.method} · {payment.status}</p>
            </div>
            {payment.refunds.length ? (
              <div className="mt-3 grid gap-2 border-t border-[var(--line)] pt-3">
                {payment.refunds.map((refund) => (
                  <div key={refund.id} className="rounded bg-[#f7f7f4] p-3 text-sm">
                    <strong>{formatVnd(refund.amount)} · {refund.status}</strong>
                    <p className="text-xs text-[var(--muted)]">{refund.reason || 'No reason'} · {new Date(refund.createdAt).toLocaleString('vi-VN')}</p>
                    {refund.failureReason ? <p className="text-xs text-red-700">{refund.failureReason}</p> : null}
                  </div>
                ))}
              </div>
            ) : <p className="mt-3 text-sm text-[var(--muted)]">No refunds.</p>}
          </article>
        ))}
      </div>
    </AppShell>
  );
}
