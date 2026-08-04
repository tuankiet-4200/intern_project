'use client';

import { AppShell } from '@/components/AppShell';
import { apiRequest, formatVnd } from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: string;
  createdAt: string;
  shopOrders: Array<{
    id: string;
    status: string;
    totalAmount: string;
    shop: { name: string };
    items: Array<{ id: string; productName: string; quantity: number; lineTotal: string }>;
  }>;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setOrders(await apiRequest<Order[]>('/orders', {}, true));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function cancel(orderId: string) {
    setError('');
    try {
      await apiRequest(`/orders/${orderId}/cancel`, { method: 'PATCH' }, true);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to cancel order');
    }
  }

  return (
    <AppShell>
      <div className="flex items-end justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">My orders</h1><p className="text-sm text-[var(--muted)]">One checkout can contain multiple shop orders.</p></div>
        <button className="rounded border border-[var(--line)] px-3 py-2 text-sm" onClick={() => void load()}>Refresh</button>
      </div>
      {loading ? <p className="mt-4 rounded-md border border-[var(--line)] bg-white p-4">Loading orders…</p> : null}
      {error ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <div className="mt-4 grid gap-4">
        {orders.map((order) => (
          <article key={order.id} className="overflow-hidden rounded-md border border-[var(--line)] bg-white">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[#f0f0ea] p-4">
              <div><h2 className="font-semibold">{order.orderNumber}</h2><p className="text-xs text-[var(--muted)]">{new Date(order.createdAt).toLocaleString('vi-VN')}</p></div>
              <div className="text-right"><p className="font-semibold">{formatVnd(order.totalAmount)}</p><p className="text-xs text-[var(--muted)]">{order.status} · {order.paymentStatus}</p></div>
            </header>
            <div className="grid gap-3 p-4">
              {order.shopOrders.map((shopOrder) => (
                <section key={shopOrder.id} className="rounded border border-[var(--line)] p-3">
                  <div className="flex justify-between gap-3"><h3 className="font-medium">{shopOrder.shop.name}</h3><span className="text-xs text-[var(--muted)]">{shopOrder.status}</span></div>
                  {shopOrder.items.map((item) => <p key={item.id} className="mt-2 flex justify-between text-sm"><span>{item.productName} × {item.quantity}</span><span>{formatVnd(item.lineTotal)}</span></p>)}
                </section>
              ))}
              {order.status === 'PLACED' ? <button className="justify-self-start text-sm text-red-700" onClick={() => void cancel(order.id)}>Cancel order</button> : null}
            </div>
          </article>
        ))}
        {!loading && orders.length === 0 ? <p className="rounded-md border border-[var(--line)] bg-white p-4 text-[var(--muted)]">You have no orders yet.</p> : null}
      </div>
    </AppShell>
  );
}
