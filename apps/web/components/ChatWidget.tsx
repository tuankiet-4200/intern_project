'use client';

import { Maximize2, MessageCircle, X } from 'lucide-react';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import type { Session } from '@/lib/api';
import type { ChatMode } from '@/lib/chat';
import { closeChatWidget, getChatWidgetState, openChatWidget, subscribeChatWidget } from '@/lib/chat-widget-store';
import { ChatMessenger } from './ChatMessenger';

const SERVER_CHAT_WIDGET_STATE = { open: false, targetShopId: null } as const;

export function ChatWidget({ session, mode }: { session: Session; mode: ChatMode }) {
  const state = useSyncExternalStore(subscribeChatWidget, getChatWidgetState, () => SERVER_CHAT_WIDGET_STATE);
  const fullPageHref = mode === 'SHOP' ? '/vendor/messages' : '/messages';

  return (
    <div className="fixed bottom-24 right-4 z-50 md:bottom-6 md:right-6">
      {state.open ? (
        <section className="fixed inset-3 z-50 overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-2xl sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[620px] sm:w-[390px]">
          <header className="flex h-14 items-center gap-2 bg-[#123b31] px-4 text-white"><MessageCircle size={18} /><strong className="text-sm">{mode === 'SHOP' ? 'Chat của shop' : 'Chat với shop'}</strong><Link href={fullPageHref} className="ml-auto rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Mở màn hình chat"><Maximize2 size={16} /></Link><button type="button" className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" onClick={closeChatWidget} aria-label="Đóng chat"><X size={17} /></button></header>
          <div className="h-[calc(100%-56px)]"><ChatMessenger session={session} mode={mode} compact targetShopId={state.targetShopId} /></div>
        </section>
      ) : (
        <button type="button" className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#123b31] text-emerald-200 shadow-2xl transition hover:-translate-y-1 hover:bg-[#17483c]" onClick={() => openChatWidget()} aria-label="Mở chat"><MessageCircle size={24} /></button>
      )}
    </div>
  );
}
