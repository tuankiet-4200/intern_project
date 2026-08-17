'use client';

import { MessageCircle } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { AppShell } from '@/components/AppShell';
import { ChatMessenger } from '@/components/ChatMessenger';
import { getSession, subscribeSession } from '@/lib/api';

export default function VendorMessagesPage() {
  const session = useSyncExternalStore(subscribeSession, getSession, () => null);

  if (!session) return <AppShell><div className="grid min-h-[55vh] place-items-center"><span className="loading-spinner" /></div></AppShell>;

  return (
    <AppShell>
      <section>
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow">Customer care</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.035em]">Hộp thư cửa hàng</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Trả lời khách hàng và bật hoặc tắt DeepSeek AI theo từng shop.</p>
          </div>
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800"><MessageCircle size={14} /> Realtime + polling dự phòng</span>
        </div>
        <ChatMessenger session={session} mode="SHOP" />
      </section>
    </AppShell>
  );
}
