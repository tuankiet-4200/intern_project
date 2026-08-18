'use client';

import { AppShell } from '@/components/AppShell';
import { apiRequest, formatVnd } from '@/lib/api';
import { productDetailPath } from '@/lib/product-detail';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type OrderItem = {
  id: string;
  productId: string;
  productName: string;
  product: { slug: string };
  quantity: number;
  lineTotal: string;
};
type Order = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: string;
  createdAt: string;
  payments: Array<{
    id: string;
    method: string;
    status: string;
    amount: string;
    refunds: Array<{
      id: string;
      amount: string;
      status: string;
      reason: string | null;
      failureReason: string | null;
      createdAt: string;
    }>;
  }>;
  shopOrders: Array<{
    id: string;
    status: string;
    totalAmount: string;
    shop: { name: string };
    items: OrderItem[];
  }>;
};
type Review = { id: string; orderItemId: string; rating: number; comment: string | null };

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [reviewingItemId, setReviewingItemId] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const reviewByItem = useMemo(
    () => new Map(reviews.map((review) => [review.orderItemId, review])),
    [reviews],
  );

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [orderResult, reviewResult] = await Promise.all([
        apiRequest<Order[]>('/orders', {}, true),
        apiRequest<Review[]>('/reviews/me', {}, true),
      ]);
      setOrders(orderResult);
      setReviews(reviewResult);
      setLastUpdated(new Date());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load orders');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void load(), 0);
    const pollingTimer = window.setInterval(() => void load(true), 15_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(pollingTimer);
    };
  }, [load]);

  async function cancel(orderId: string) {
    setError('');
    try {
      await apiRequest(`/orders/${orderId}/cancel`, { method: 'PATCH' }, true);
      await load(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to cancel order');
    }
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingReview(true);
    setError('');
    try {
      await apiRequest('/reviews', {
        method: 'POST',
        body: JSON.stringify({ orderItemId: reviewingItemId, rating, comment: comment.trim() || undefined }),
      }, true);
      setReviewingItemId('');
      setRating(5);
      setComment('');
      await load(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to submit review');
    } finally {
      setSubmittingReview(false);
    }
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">My orders</h1>
          <p className="text-sm text-[var(--muted)]">Orders and delivery states refresh automatically every 15 seconds.</p>
        </div>
        <div className="text-right">
          <button className="rounded border border-[var(--line)] px-3 py-2 text-sm" onClick={() => void load()}>Refresh</button>
          {lastUpdated ? <p className="mt-1 text-xs text-[var(--muted)]">Updated {lastUpdated.toLocaleTimeString('vi-VN')}</p> : null}
        </div>
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
              {order.payments.flatMap((payment) => payment.refunds.map((refund) => (
                <div key={refund.id} className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  Refund {formatVnd(refund.amount)} · {refund.status}
                  <span className="block text-xs">{refund.reason || 'No reason provided'}{refund.failureReason ? ` · ${refund.failureReason}` : ''}</span>
                </div>
              )))}
              {order.shopOrders.map((shopOrder) => (
                <section key={shopOrder.id} className="rounded border border-[var(--line)] p-3">
                  <div className="flex justify-between gap-3"><h3 className="font-medium">{shopOrder.shop.name}</h3><span className="text-xs text-[var(--muted)]">{shopOrder.status}</span></div>
                  {shopOrder.items.map((item) => {
                    const review = reviewByItem.get(item.id);
                    return (
                      <div key={item.id} className="mt-2 border-t border-[var(--line)] pt-2 first:border-t-0">
                        <p className="flex justify-between gap-3 text-sm"><span><Link href={productDetailPath(item.product.slug)} className="font-medium hover:text-[var(--accent)] hover:underline">{item.productName}</Link> × {item.quantity}</span><span className="shrink-0">{formatVnd(item.lineTotal)}</span></p>
                        {review ? <p className="mt-1 text-xs text-amber-700">Reviewed {review.rating}/5{review.comment ? ` · ${review.comment}` : ''}</p> : null}
                        {shopOrder.status === 'DELIVERED' && !review ? (
                          <button className="mt-2 text-xs font-medium text-[var(--accent-strong)]" onClick={() => setReviewingItemId(item.id)}>Review this product</button>
                        ) : null}
                        {reviewingItemId === item.id ? (
                          <form className="mt-3 grid gap-2 rounded bg-[#f7f7f4] p-3" onSubmit={submitReview}>
                            <label className="grid gap-1 text-xs">Rating
                              <select className="h-9 rounded border border-[var(--line)] px-2" value={rating} onChange={(event) => setRating(Number(event.target.value))}>
                                {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} / 5</option>)}
                              </select>
                            </label>
                            <textarea className="min-h-20 rounded border border-[var(--line)] p-2 text-sm" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} placeholder="Share your experience (optional)" />
                            <div className="flex gap-2">
                              <button className="rounded bg-[var(--accent)] px-3 py-2 text-xs text-white disabled:opacity-60" disabled={submittingReview}>{submittingReview ? 'Submitting…' : 'Submit review'}</button>
                              <button type="button" className="rounded border border-[var(--line)] px-3 py-2 text-xs" onClick={() => setReviewingItemId('')}>Cancel</button>
                            </div>
                          </form>
                        ) : null}
                      </div>
                    );
                  })}
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
