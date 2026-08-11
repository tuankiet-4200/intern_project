'use client';

import { AppShell } from '@/components/AppShell';
import { apiRequest } from '@/lib/api';
import { CheckCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationPage = {
  data: Notification[];
  total: number;
  unread: number;
  page: number;
  limit: number;
};

export default function NotificationsPage() {
  const [result, setResult] = useState<NotificationPage | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setResult(await apiRequest<NotificationPage>(
        `/notifications?limit=100${unreadOnly ? '&unreadOnly=true' : ''}`,
        {},
        true,
      ));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load notifications');
    } finally {
      setLoading(false);
    }
  }, [unreadOnly]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function markRead(notificationId: string) {
    setError('');
    try {
      await apiRequest(`/notifications/${notificationId}/read`, { method: 'PATCH' }, true);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to mark notification read');
    }
  }

  async function markAllRead() {
    setError('');
    try {
      await apiRequest('/notifications/read-all', { method: 'PATCH' }, true);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to mark all notifications read');
    }
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="text-sm text-[var(--muted)]">Persisted updates for shops, orders, payments and refunds.</p>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded border border-[var(--line)] px-3 py-2 text-sm"
            onClick={() => setUnreadOnly((value) => !value)}
          >
            {unreadOnly ? 'Show all' : 'Unread only'}
          </button>
          <button
            className="flex items-center gap-2 rounded bg-[var(--accent)] px-3 py-2 text-sm text-white disabled:opacity-60"
            onClick={() => void markAllRead()}
            disabled={!result?.unread}
          >
            <CheckCheck size={16} /> Mark all read
          </button>
        </div>
      </div>

      {result ? <p className="mt-2 text-sm text-[var(--muted)]">{result.unread} unread · {result.total} shown in this filter</p> : null}
      {loading ? <p className="mt-4 rounded border border-[var(--line)] bg-white p-4">Loading notifications…</p> : null}
      {error ? <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <div className="mt-4 grid gap-3">
        {result?.data.map((notification) => (
          <article
            key={notification.id}
            className={`rounded-md border p-4 ${notification.readAt ? 'border-[var(--line)] bg-white' : 'border-teal-300 bg-teal-50'}`}
          >
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-[var(--accent-strong)]">{notification.type.replaceAll('_', ' ')}</p>
                <h2 className="mt-1 font-semibold">{notification.title}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">{notification.message}</p>
                <p className="mt-2 text-xs text-[var(--muted)]">{new Date(notification.createdAt).toLocaleString('vi-VN')}</p>
              </div>
              {!notification.readAt ? (
                <button className="self-start text-sm font-medium text-[var(--accent-strong)]" onClick={() => void markRead(notification.id)}>
                  Mark read
                </button>
              ) : null}
            </div>
          </article>
        ))}
        {!loading && result?.data.length === 0 ? (
          <p className="rounded border border-[var(--line)] bg-white p-4 text-[var(--muted)]">No notifications in this view.</p>
        ) : null}
      </div>
    </AppShell>
  );
}
