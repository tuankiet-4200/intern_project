'use client';

import { AlertTriangle, LoaderCircle, X } from 'lucide-react';
import { useState } from 'react';

export function AdminActionDialog({
  title,
  description,
  confirmLabel,
  reasonRequired,
  destructive = false,
  loading,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  reasonRequired: boolean;
  destructive?: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const invalid = reasonRequired && reason.trim().length < 5;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-[#0a1f1a]/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !loading) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="admin-action-title" className="w-full max-w-md rounded-3xl border border-white/60 bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${destructive ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}><AlertTriangle size={20} /></span>
          <div className="min-w-0 flex-1"><h2 id="admin-action-title" className="text-xl font-black">{title}</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">{description}</p></div>
          <button type="button" className="icon-button !h-9 !w-9" disabled={loading} onClick={onClose} aria-label="Đóng"><X size={16} /></button>
        </div>
        <label className="mt-5 grid gap-1.5 text-sm font-semibold">Lý do {reasonRequired ? <span className="text-red-600">(bắt buộc)</span> : <span className="font-normal text-[var(--muted)]">(không bắt buộc)</span>}
          <textarea className="min-h-24 rounded-xl border border-[var(--line)] p-3 font-normal" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Ghi rõ căn cứ xử lý hoặc mã ticket hỗ trợ…" autoFocus />
        </label>
        {invalid && reason.length > 0 ? <p className="mt-2 text-xs text-red-600">Lý do cần ít nhất 5 ký tự.</p> : null}
        <div className="mt-6 flex justify-end gap-2"><button type="button" className="button-ghost" disabled={loading} onClick={onClose}>Hủy</button><button type="button" className={destructive ? 'inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-50' : 'button-primary'} disabled={loading || invalid} onClick={() => onConfirm(reason.trim())}>{loading ? <LoaderCircle size={16} className="animate-spin" /> : null}{confirmLabel}</button></div>
      </section>
    </div>
  );
}
