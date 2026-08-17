'use client';

import { Bot, ChevronLeft, LoaderCircle, MessageCircle, Send, Store, Sparkles, UserRound } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { apiRequest, API_ORIGIN, type Session } from '@/lib/api';
import {
  chatMessageLabel,
  chatPeerName,
  mergeChatMessage,
  type ChatConversation,
  type ChatMessage,
  type ChatMode,
  type ShopAiSetting,
} from '@/lib/chat';
import { clearChatTarget } from '@/lib/chat-widget-store';

type VendorShop = { id: string; name: string; status: string; aiChatEnabled: boolean };

export function ChatMessenger({
  session,
  mode,
  compact = false,
  targetShopId = null,
}: {
  session: Session;
  mode: ChatMode;
  compact?: boolean;
  targetShopId?: string | null;
}) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [vendorShops, setVendorShops] = useState<VendorShop[]>([]);
  const [aiSettings, setAiSettings] = useState<Record<string, ShopAiSetting>>({});
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [olderMessagesLoading, setOlderMessagesLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const selectedIdRef = useRef('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async (preserveSelection = true) => {
    const data = await apiRequest<ChatConversation[]>(`/chat/conversations?view=${mode}`, {}, true);
    setConversations(data);
    setSelectedId((current) => preserveSelection && data.some((item) => item.id === current) ? current : data[0]?.id ?? '');
    return data;
  }, [mode]);

  const loadMessages = useCallback(async (conversationId: string, silent = false) => {
    if (!silent) setMessagesLoading(true);
    try {
      const result = await apiRequest<{ data: ChatMessage[]; nextCursor: string | null }>(`/chat/conversations/${conversationId}/messages?limit=100`, {}, true);
      if (selectedIdRef.current !== conversationId) return;
      if (silent) {
        setMessages((current) => result.data.reduce(mergeChatMessage, current));
      } else {
        setMessages(result.data);
        setNextCursor(result.nextCursor);
      }
      await apiRequest(`/chat/conversations/${conversationId}/read`, { method: 'PATCH' }, true);
    } finally {
      if (!silent) setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void Promise.all([
        loadConversations(false),
        mode === 'SHOP' ? apiRequest<VendorShop[]>('/shops/me', {}, true) : Promise.resolve([]),
      ])
        .then(async ([, shops]) => {
          if (!active) return;
          setVendorShops(shops);
          if (mode === 'SHOP') {
            const settings = await Promise.all(shops.map((shop) => apiRequest<ShopAiSetting>(`/chat/shops/${shop.id}/ai`, {}, true)));
            if (active) setAiSettings(Object.fromEntries(settings.map((setting) => [setting.shopId, setting])));
          }
        })
        .catch((requestError) => active && setError(requestError instanceof Error ? requestError.message : 'Không thể tải hội thoại.'))
        .finally(() => active && setLoading(false));
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [loadConversations, mode]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (mode !== 'CUSTOMER' || !targetShopId) return;
    let active = true;
    apiRequest<ChatConversation>('/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({ shopId: targetShopId }),
    }, true)
      .then(async (conversation) => {
        if (!active) return;
        await loadConversations();
        setSelectedId(conversation.id);
        clearChatTarget();
      })
      .catch((requestError) => active && setError(requestError instanceof Error ? requestError.message : 'Không thể mở chat với shop.'));
    return () => { active = false; };
  }, [loadConversations, mode, targetShopId]);

  useEffect(() => {
    const socket = io(`${API_ORIGIN}/chat`, {
      auth: { token: session.accessToken },
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
    socketRef.current = socket;
    socket.on('connect', () => {
      setConnected(true);
      if (selectedIdRef.current) socket.emit('chat:join', { conversationId: selectedIdRef.current });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('chat:message', (event: { conversationId: string; message: ChatMessage }) => {
      if (event.conversationId === selectedIdRef.current) setMessages((current) => mergeChatMessage(current, event.message));
      void loadConversations();
    });
    socket.on('chat:ai-status', (event: { conversationId: string; messageId: string; status: ChatMessage['aiStatus'] }) => {
      if (event.conversationId !== selectedIdRef.current) return;
      setMessages((current) => current.map((message) => message.id === event.messageId ? { ...message, aiStatus: event.status } : message));
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [loadConversations, session.accessToken]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    const initialLoadTimer = window.setTimeout(() => {
      void loadMessages(selectedId).catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Không thể tải tin nhắn.'));
    }, 0);
    socketRef.current?.emit('chat:join', { conversationId: selectedId });
    const timer = window.setInterval(() => void loadMessages(selectedId, true).catch(() => undefined), 5_000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(initialLoadTimer);
      socketRef.current?.emit('chat:leave', { conversationId: selectedId });
    };
  }, [loadMessages, selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages]);

  async function sendMessage() {
    const content = draft.trim();
    if (!selectedId || !content || sending) return;
    setSending(true);
    setError('');
    setDraft('');
    try {
      const message = await apiRequest<ChatMessage>(`/chat/conversations/${selectedId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, clientMessageId: crypto.randomUUID() }),
      }, true);
      setMessages((current) => mergeChatMessage(current, message));
      await loadConversations();
    } catch (requestError) {
      setDraft(content);
      setError(requestError instanceof Error ? requestError.message : 'Không thể gửi tin nhắn.');
    } finally {
      setSending(false);
    }
  }

  async function loadOlderMessages() {
    if (!selectedId || !nextCursor || olderMessagesLoading) return;
    setOlderMessagesLoading(true);
    setError('');
    try {
      const result = await apiRequest<{ data: ChatMessage[]; nextCursor: string | null }>(`/chat/conversations/${selectedId}/messages?limit=100&cursor=${encodeURIComponent(nextCursor)}`, {}, true);
      if (selectedIdRef.current !== selectedId) return;
      setMessages((current) => result.data.reduce(mergeChatMessage, current));
      setNextCursor(result.nextCursor);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể tải tin nhắn cũ hơn.');
    } finally {
      setOlderMessagesLoading(false);
    }
  }

  async function toggleAi(shopId: string) {
    const current = aiSettings[shopId];
    if (!current) return;
    setError('');
    try {
      const next = await apiRequest<ShopAiSetting>(`/chat/shops/${shopId}/ai`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !current.enabled }),
      }, true);
      setAiSettings((settings) => ({ ...settings, [shopId]: next }));
      setConversations((items) => items.map((conversation) => conversation.shop.id === shopId
        ? { ...conversation, shop: { ...conversation.shop, aiChatEnabled: next.enabled } }
        : conversation));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể cập nhật AI chatbot.');
    }
  }

  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? null;
  const showConversationList = !compact || !selected;
  const showChat = !compact || Boolean(selected);

  return (
    <div className={`grid min-h-0 overflow-hidden bg-white ${compact ? 'h-full' : 'h-[min(720px,calc(100vh-190px))] rounded-3xl border border-[var(--line)] shadow-[var(--shadow-sm)] md:grid-cols-[320px_minmax(0,1fr)]'}`}>
      {showConversationList ? (
        <aside className={`flex min-h-0 flex-col border-[var(--line)] bg-[#f7faf8] ${compact ? '' : 'border-r'}`}>
          <div className="border-b border-[var(--line)] p-4">
            <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">{mode === 'SHOP' ? 'Hộp thư shop' : 'Tin nhắn'}</p><h2 className="mt-1 font-extrabold">Hội thoại gần đây</h2></div><span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-400'}`} title={connected ? 'Realtime đã kết nối' : 'Đang dùng polling dự phòng'} /></div>
          </div>
          {mode === 'SHOP' && vendorShops.length ? (
            <div className="grid gap-2 border-b border-[var(--line)] p-3">
              {vendorShops.map((shop) => {
                const setting = aiSettings[shop.id];
                return <div key={shop.id} className="rounded-xl border border-emerald-100 bg-white p-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-bold">AI · {shop.name}</p><p className="mt-1 text-[10px] text-[var(--muted)]">{setting?.configured ? 'DeepSeek đã cấu hình' : 'Thiếu DEEPSEEK_API_KEY'}</p></div><button type="button" role="switch" aria-checked={setting?.enabled ?? false} className={`relative h-6 w-11 shrink-0 rounded-full transition ${setting?.enabled ? 'bg-[var(--accent)]' : 'bg-gray-300'}`} disabled={!setting} onClick={() => void toggleAi(shop.id)}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${setting?.enabled ? 'left-6' : 'left-1'}`} /></button></div></div>;
              })}
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {loading ? <ChatState icon={LoaderCircle} text="Đang tải hội thoại…" spinning /> : conversations.length ? conversations.map((conversation) => (
              <button key={conversation.id} type="button" className={`mb-1 flex w-full gap-3 rounded-xl p-3 text-left transition ${conversation.id === selectedId ? 'bg-emerald-100' : 'hover:bg-white'}`} onClick={() => setSelectedId(conversation.id)}>
                <Avatar name={chatPeerName(conversation, mode)} />
                <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><strong className="truncate text-sm">{chatPeerName(conversation, mode)}</strong>{conversation.unreadCount ? <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{conversation.unreadCount}</span> : null}</span><span className="mt-1 block truncate text-xs text-[var(--muted)]">{conversation.lastMessage?.content ?? 'Bắt đầu cuộc trò chuyện'}</span></span>
              </button>
            )) : <ChatState icon={MessageCircle} text={mode === 'SHOP' ? 'Chưa có khách hàng nhắn tin.' : 'Bạn chưa có cuộc trò chuyện nào.'} />}
          </div>
        </aside>
      ) : null}

      {showChat ? (
        <section className="grid min-h-0 grid-rows-[auto_1fr_auto]">
          {selected ? (
            <>
              <header className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
                {compact ? <button type="button" className="icon-button !h-9 !w-9" onClick={() => setSelectedId('')} aria-label="Quay lại danh sách"><ChevronLeft size={17} /></button> : null}
                <Avatar name={chatPeerName(selected, mode)} />
                <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-extrabold">{chatPeerName(selected, mode)}</h3><p className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--muted)]">{selected.shop.aiChatEnabled ? <><Sparkles size={11} className="text-violet-600" /> AI có thể hỗ trợ</> : mode === 'CUSTOMER' ? 'Nhân viên shop sẽ phản hồi' : selected.shop.name}</p></div>
              </header>
              <div className="min-h-0 overflow-y-auto bg-[#f5f8f6] p-4">
                {messagesLoading ? <ChatState icon={LoaderCircle} text="Đang tải tin nhắn…" spinning /> : messages.length ? (
                  <div className="grid gap-3">
                    {nextCursor ? <button type="button" className="mx-auto rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--muted)] hover:text-[var(--accent)]" disabled={olderMessagesLoading} onClick={() => void loadOlderMessages()}>{olderMessagesLoading ? 'Đang tải…' : 'Xem tin nhắn cũ hơn'}</button> : null}
                    {messages.map((message) => {
                      const own = mode === 'CUSTOMER' ? message.senderType === 'CUSTOMER' : message.senderType === 'SHOP';
                      return <div key={message.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-sm ${own ? 'rounded-br-md bg-[var(--accent)] text-white' : message.senderType === 'AI' ? 'rounded-bl-md border border-violet-100 bg-violet-50 text-violet-950' : 'rounded-bl-md bg-white'}`}><p className={`mb-1 flex items-center gap-1 text-[10px] font-bold ${own ? 'text-white/70' : 'text-[var(--muted)]'}`}>{message.senderType === 'AI' ? <Bot size={11} /> : null}{chatMessageLabel(message, mode)}</p><p className="whitespace-pre-wrap break-words">{message.content}</p><p className={`mt-1 text-right text-[9px] ${own ? 'text-white/60' : 'text-[var(--muted)]'}`}>{new Date(message.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p></div></div>;
                    })}
                    {messages.some((message) => message.aiStatus === 'PENDING') ? <div className="flex items-center gap-2 text-xs text-violet-700"><LoaderCircle size={14} className="animate-spin" /> AI của shop đang soạn câu trả lời…</div> : null}
                    <div ref={bottomRef} />
                  </div>
                ) : <ChatState icon={MessageCircle} text="Hãy gửi tin nhắn đầu tiên." />}
              </div>
              <div className="border-t border-[var(--line)] bg-white p-3">
                {error ? <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}
                <div className="flex items-end gap-2"><textarea className="max-h-28 min-h-11 flex-1 resize-none rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Nhập tin nhắn…" maxLength={2000} rows={1} /><button type="button" className="button-primary !h-11 !w-11 !p-0" disabled={!draft.trim() || sending} onClick={() => void sendMessage()} aria-label="Gửi tin nhắn">{sending ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={17} />}</button></div>
              </div>
            </>
          ) : <ChatState icon={mode === 'SHOP' ? Store : UserRound} text="Chọn một hội thoại để bắt đầu." />}
        </section>
      ) : null}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join('').toUpperCase() || 'C';
  return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#123b31] text-xs font-black text-emerald-200">{initials}</span>;
}

function ChatState({ icon: Icon, text, spinning = false }: { icon: typeof MessageCircle; text: string; spinning?: boolean }) {
  return <div className="grid min-h-40 place-items-center p-6 text-center"><div><Icon className={`mx-auto text-[var(--muted)] ${spinning ? 'animate-spin' : ''}`} size={24} /><p className="mt-3 text-sm text-[var(--muted)]">{text}</p></div></div>;
}
