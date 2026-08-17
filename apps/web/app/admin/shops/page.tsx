'use client';

import {
  ChevronLeft,
  ChevronRight,
  Eye,
  MessageCircle,
  PackageSearch,
  RefreshCw,
  Search,
  ShoppingBag,
  Store,
  Tags,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AdminActionDialog } from '@/components/AdminActionDialog';
import { AppShell } from '@/components/AppShell';
import { SelectMenu } from '@/components/SelectMenu';
import { apiRequest } from '@/lib/api';
import {
  ACCOUNT_STATUS_LABELS,
  governanceStatusLabel,
  SHOP_STATUS_LABELS,
  statusTone,
  shopStatusActions,
  USER_ROLE_LABELS,
  type AccountStatus,
  type GovernanceAction,
  type ShopStatus,
  type UserRole,
} from '@/lib/admin-governance';

type ShopOwner = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: AccountStatus;
};
type AdminShop = {
  id: string;
  name: string;
  slug: string;
  description: string;
  logoUrl: string | null;
  status: ShopStatus;
  rating: string;
  aiChatEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  owner: ShopOwner;
  _count: { products: number; shopOrders: number; chatConversations: number };
};
type ShopDetail = Omit<AdminShop, '_count'> & {
  products: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    price: string;
    updatedAt: string;
    inventory: { onHand: number; reserved: number; sold: number } | null;
  }>;
  _count: { products: number; shopOrders: number; coupons: number; chatConversations: number };
  auditLogs: Array<{
    id: string;
    reason: string | null;
    before: { status?: string };
    after: { status?: string };
    createdAt: string;
    actor: { fullName: string; email: string };
  }>;
};
type ShopPage = { items: AdminShop[]; total: number; page: number; limit: number; totalPages: number };
type ShopAction = { shop: AdminShop; action: GovernanceAction<ShopStatus> };

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'PENDING_REVIEW', label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Đang hoạt động' },
  { value: 'SUSPENDED', label: 'Đang đình chỉ' },
  { value: 'REJECTED', label: 'Đã từ chối' },
] as const;

export default function AdminShopsPage() {
  const [result, setResult] = useState<ShopPage>({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | ShopStatus>('ALL');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ShopDetail | null>(null);
  const [action, setAction] = useState<ShopAction | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) params.set('search', search);
    if (status !== 'ALL') params.set('status', status);
    try {
      setResult(await apiRequest<ShopPage>(`/admin/shops?${params.toString()}`, {}, true));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể tải danh sách cửa hàng.');
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function viewDetail(shopId: string) {
    setDetailLoading(true);
    setError('');
    try {
      setSelected(await apiRequest<ShopDetail>(`/admin/shops/${shopId}`, {}, true));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể tải chi tiết cửa hàng.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function confirmAction(reason: string) {
    if (!action) return;
    setSaving(true);
    setError('');
    try {
      await apiRequest(`/admin/shops/${action.shop.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: action.action.target, reason: reason || undefined }),
      }, true);
      const selectedId = selected?.id;
      setAction(null);
      await load();
      if (selectedId === action.shop.id) await viewDetail(selectedId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể cập nhật cửa hàng.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <section>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow">Marketplace governance</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.035em]">Quản lý cửa hàng</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Duyệt hồ sơ, giám sát hoạt động và xử lý trạng thái cửa hàng có audit.</p>
          </div>
          <button type="button" className="button-ghost self-start" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Làm mới
          </button>
        </div>

        <div className="surface-card mt-6 grid gap-3 p-4 lg:grid-cols-[minmax(260px,1fr)_260px]">
          <form className="flex items-end gap-2" onSubmit={submitSearch}>
            <label className="grid flex-1 gap-1.5 text-sm font-semibold">
              Tìm kiếm
              <input className="h-12 rounded-xl border border-[var(--line)] px-3.5 font-normal" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} maxLength={100} placeholder="Tên shop, slug hoặc chủ cửa hàng" />
            </label>
            <button type="submit" className="button-primary !h-12"><Search size={16} /><span className="hidden sm:inline">Tìm</span></button>
          </form>
          <SelectMenu label="Trạng thái" value={status} options={[...STATUS_OPTIONS]} onChange={(value) => { setStatus(value); setPage(1); }} />
        </div>

        {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-4 flex items-center justify-between text-sm text-[var(--muted)]"><span><strong className="text-[var(--foreground)]">{result.total}</strong> cửa hàng</span><span>Trang {result.page}/{Math.max(result.totalPages, 1)}</span></div>

        <div className="mt-3 grid gap-3">
          {loading ? <LoadingRows /> : result.items.map((shop) => (
            <article key={shop.id} className="surface-card grid gap-4 p-4 xl:grid-cols-[minmax(0,1.4fr)_190px_220px_auto] xl:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <ShopAvatar shop={shop} />
                <div className="min-w-0"><h2 className="truncate font-extrabold">{shop.name}</h2><p className="truncate text-sm text-[var(--muted)]">/{shop.slug}</p><p className="mt-1 truncate text-xs text-[var(--muted)]">{shop.owner.fullName} · {shop.owner.email}</p></div>
              </div>
              <div><p className="text-xs text-[var(--muted)]">Chủ cửa hàng</p><p className="mt-1 text-sm font-bold">{ACCOUNT_STATUS_LABELS[shop.owner.status]}</p><p className="text-xs text-[var(--muted)]">{USER_ROLE_LABELS[shop.owner.role]}</p></div>
              <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]"><span>{shop._count.products} sản phẩm</span><span>·</span><span>{shop._count.shopOrders} đơn</span><span>·</span><span>{shop._count.chatConversations} chat</span></div>
              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(shop.status)}`}>{SHOP_STATUS_LABELS[shop.status]}</span>
                <button type="button" className="icon-button !h-9 !w-9" onClick={() => void viewDetail(shop.id)} aria-label={`Xem ${shop.name}`}><Eye size={16} /></button>
                {shopStatusActions(shop.status).map((nextAction) => <button key={nextAction.target} type="button" className={nextAction.destructive ? 'rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700' : 'button-soft !min-h-9 !px-3 !py-2 text-xs'} onClick={() => setAction({ shop, action: nextAction })}>{nextAction.label}</button>)}
              </div>
            </article>
          ))}
          {!loading && result.items.length === 0 ? <div className="surface-card grid min-h-52 place-items-center p-8 text-center"><div><Store className="mx-auto text-[var(--muted)]" size={30} /><h2 className="mt-3 font-extrabold">Không tìm thấy cửa hàng</h2><p className="mt-1 text-sm text-[var(--muted)]">Thử thay đổi từ khóa hoặc bộ lọc trạng thái.</p></div></div> : null}
        </div>

        <Pagination page={result.page} totalPages={result.totalPages} onPage={setPage} />
        {detailLoading ? <p className="mt-5 text-sm text-[var(--muted)]">Đang tải chi tiết…</p> : selected ? <ShopDetailPanel shop={selected} onClose={() => setSelected(null)} /> : null}
      </section>
      {action ? <AdminActionDialog title={action.action.title} description={action.action.description} confirmLabel={action.action.label} reasonRequired={action.action.reasonRequired} destructive={action.action.destructive} loading={saving} onClose={() => setAction(null)} onConfirm={(reason) => void confirmAction(reason)} /> : null}
    </AppShell>
  );
}

function ShopDetailPanel({ shop, onClose }: { shop: ShopDetail; onClose: () => void }) {
  return (
    <section className="surface-card mt-5 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">Chi tiết cửa hàng</p><h2 className="mt-2 text-xl font-black">{shop.name}</h2><p className="mt-1 text-sm text-[var(--muted)]">{shop.description || 'Chưa có mô tả'} · tạo ngày {new Date(shop.createdAt).toLocaleString('vi-VN')}</p></div><button type="button" className="button-ghost !min-h-9 !px-3" onClick={onClose}>Đóng</button></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-4"><Metric icon={PackageSearch} label="Sản phẩm" value={shop._count.products} /><Metric icon={ShoppingBag} label="Đơn bán" value={shop._count.shopOrders} /><Metric icon={MessageCircle} label="Cuộc chat" value={shop._count.chatConversations} /><Metric icon={Tags} label="Mã giảm giá" value={shop._count.coupons} /></div>
      <div className="mt-5 grid gap-4 rounded-2xl bg-[#f5f8f6] p-4 sm:grid-cols-2"><div><p className="text-xs text-[var(--muted)]">Chủ sở hữu</p><p className="mt-1 font-extrabold">{shop.owner.fullName}</p><p className="text-sm text-[var(--muted)]">{shop.owner.email}</p></div><div><p className="text-xs text-[var(--muted)]">AI Chatbot</p><p className="mt-1 font-extrabold">{shop.aiChatEnabled ? 'Đang bật' : 'Đang tắt'}</p><p className="text-sm text-[var(--muted)]">Đánh giá shop: {shop.rating}</p></div></div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div><h3 className="font-extrabold">Sản phẩm cập nhật gần đây</h3><div className="mt-3 grid gap-2">{shop.products.length ? shop.products.map((product) => <div key={product.id} className="rounded-xl bg-[#f5f8f6] p-3"><div className="flex justify-between gap-2"><strong className="line-clamp-1">{product.name}</strong><span className="shrink-0 text-xs font-bold">{product.status}</span></div><p className="mt-1 text-xs text-[var(--muted)]">Tồn {product.inventory?.onHand ?? 0} · giữ {product.inventory?.reserved ?? 0} · đã bán {product.inventory?.sold ?? 0}</p></div>) : <p className="text-sm text-[var(--muted)]">Chưa có sản phẩm.</p>}</div></div>
        <div><h3 className="font-extrabold">Lịch sử xử lý gần đây</h3><div className="mt-3 grid gap-2">{shop.auditLogs.length ? shop.auditLogs.map((log) => <div key={log.id} className="rounded-xl border border-[var(--line)] p-3 text-sm"><strong>{governanceStatusLabel(log.before.status)} → {governanceStatusLabel(log.after.status)}</strong><p className="mt-1 text-xs text-[var(--muted)]">{log.reason || 'Không ghi lý do'} · {log.actor.fullName} · {new Date(log.createdAt).toLocaleString('vi-VN')}</p></div>) : <p className="text-sm text-[var(--muted)]">Chưa có thao tác quản trị.</p>}</div></div>
      </div>
    </section>
  );
}

function ShopAvatar({ shop }: { shop: AdminShop }) { return shop.logoUrl ? <span aria-hidden="true" className="h-12 w-12 shrink-0 rounded-xl border border-[var(--line)] bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(shop.logoUrl)})` }} /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#123b31] text-emerald-200"><Store size={20} /></span>; }
function Metric({ icon: Icon, label, value }: { icon: typeof Store; label: string; value: number }) { return <div className="rounded-xl bg-[#f5f8f6] p-3"><Icon className="text-[var(--accent)]" size={17} /><p className="mt-2 text-xl font-black">{value}</p><p className="text-xs text-[var(--muted)]">{label}</p></div>; }
function LoadingRows() { return <>{[1, 2, 3].map((item) => <div key={item} className="surface-card h-28 animate-pulse bg-white" />)}</>; }
function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) { if (totalPages <= 1) return null; return <div className="mt-5 flex justify-center gap-2"><button type="button" className="button-ghost !h-10 !px-3" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={16} /> Trước</button><button type="button" className="button-ghost !h-10 !px-3" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Sau <ChevronRight size={16} /></button></div>; }
