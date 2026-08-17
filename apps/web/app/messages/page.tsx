'use client';

import { MessageCircle } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { AppShell } from '@/components/AppShell';
import { ChatMessenger } from '@/components/ChatMessenger';
import { getSession, subscribeSession } from '@/lib/api';

export default function CustomerMessagesPage() {
  const session = useSyncExternalStore(subscribeSession, getSession, () => null);

  if (!session) return <AppShell><MessagesLoading /></AppShell>;

  return (
    <AppShell>
      <section>
        <div className="mb-6">
          <p className="eyebrow">Hỗ trợ mua sắm</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.035em]">Tin nhắn với cửa hàng</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Trao đổi trực tiếp với nhà bán hoặc nhận tư vấn nhanh từ AI của shop.</p>
        </div>
        <ChatMessenger session={session} mode="CUSTOMER" />
      </section>
    </AppShell>
  );
}

function MessagesLoading() {
  return <div className="grid min-h-[55vh] place-items-center"><div className="text-center"><MessageCircle className="mx-auto text-[var(--muted)]" /><p className="mt-3 text-sm text-[var(--muted)]">Đang mở hộp thư…</p></div></div>;
}
