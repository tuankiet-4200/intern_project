'use client';

import { AppShell } from '@/components/AppShell';
import { apiRequest, formatVnd } from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';

type Shop = { id: string; name: string; status: string };
type ShopOrderStatus = 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'PACKING' | 'READY_TO_HANDOFF' | 'DELIVERED' | 'CANCELLED';
type ShopOrder = {
  id: string;
  status: ShopOrderStatus;
  totalAmount: string;
  createdAt: string;
  items: Array<{ id: string; productName: string; quantity: number; lineTotal: string }>;
  parentOrder: { orderNumber: string; paymentStatus: string; shippingAddress: { recipient?: string; city?: string } };
};
const nextStatus: Partial<Record<ShopOrderStatus, ShopOrderStatus>> = {
  PENDING_CONFIRMATION: 'CONFIRMED',
  CONFIRMED: 'PACKING',
  PACKING: 'READY_TO_HANDOFF',
  READY_TO_HANDOFF: 'DELIVERED',
};

export default function VendorOrdersPage() {
  const [shop, setShop] = useState<Shop | null>(null);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const shops = await apiRequest<Shop[]>('/shops/me', {}, true);
      const activeShop = shops[0] ?? null;
      setShop(activeShop);
      setOrders(activeShop ? await apiRequest<ShopOrder[]>(`/shops/${activeShop.id}/orders`, {}, true) : []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load shop orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function transition(order: ShopOrder, status: ShopOrderStatus) {
    setError('');
    try {
      await apiRequest(`/shop-orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }, true);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update order');
    }
  }

  return (
    <AppShell>
      <div className="flex items-end justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Shop orders</h1><p className="text-sm text-[var(--muted)]">{shop ? `${shop.name} · ${shop.status}` : 'No shop selected'}</p></div>
        <button className="rounded border border-[var(--line)] px-3 py-2 text-sm" onClick={() => void load()}>Refresh</button>
      </div>
      {loading ? <p className="mt-4 rounded-md border border-[var(--line)] bg-white p-4">Loading shop orders…</p> : null}
      {error ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <div className="mt-4 grid gap-3">
        {orders.map((order) => (
          <article key={order.id} className="rounded-md border border-[var(--line)] bg-white p-4">
            <div className="flex flex-wrap justify-between gap-3">
              <div><h2 className="font-semibold">{order.parentOrder.orderNumber}</h2><p className="text-sm text-[var(--muted)]">{order.parentOrder.shippingAddress.recipient ?? 'Customer'} · {order.parentOrder.shippingAddress.city ?? 'Shipping address'}</p></div>
              <div className="text-right"><p className="font-semibold">{formatVnd(order.totalAmount)}</p><p className="text-xs text-[var(--muted)]">{order.status} · {order.parentOrder.paymentStatus}</p></div>
            </div>
            <div className="mt-3 border-t border-[var(--line)] pt-2">
              {order.items.map((item) => <p key={item.id} className="mt-1 flex justify-between text-sm"><span>{item.productName} × {item.quantity}</span><span>{formatVnd(item.lineTotal)}</span></p>)}
            </div>
            <div className="mt-4 flex gap-2">
              {nextStatus[order.status] ? <button className="rounded bg-[var(--accent)] px-3 py-2 text-sm text-white" onClick={() => void transition(order, nextStatus[order.status]!)}>Move to {nextStatus[order.status]}</button> : null}
              {['PENDING_CONFIRMATION', 'CONFIRMED'].includes(order.status) ? <button className="rounded border border-red-200 px-3 py-2 text-sm text-red-700" onClick={() => void transition(order, 'CANCELLED')}>Cancel</button> : null}
            </div>
          </article>
        ))}
        {!loading && orders.length === 0 ? <p className="rounded-md border border-[var(--line)] bg-white p-4 text-[var(--muted)]">No shop orders yet.</p> : null}
      </div>
    </AppShell>
  );
}
