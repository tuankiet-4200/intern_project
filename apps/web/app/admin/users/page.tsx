'use client';

import { Ban, ChevronLeft, ChevronRight, Eye, RefreshCw, Search, ShieldCheck, Store, UserCheck, UsersRound } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AdminActionDialog } from '@/components/AdminActionDialog';
import { AppShell } from '@/components/AppShell';
import { SelectMenu } from '@/components/SelectMenu';
import { apiRequest, getSession, subscribeSession } from '@/lib/api';
import { shouldResetSubmittedSearch } from '@/lib/search-filter';
import {
  ACCOUNT_STATUS_LABELS,
  governanceStatusLabel,
  statusTone,
  userStatusAction,
  USER_ROLE_LABELS,
  type AccountStatus,
  type GovernanceAction,
  type UserRole,
} from '@/lib/admin-governance';

type AdminUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
  _count: { shops: number; orders: number; reviews: number };
};
type UserDetail = Omit<AdminUser, '_count'> & {
  shops: Array<{ id: string; name: string; slug: string; status: string; rating: string; createdAt: string }>;
  _count: { addresses: number; orders: number; reviews: number; chatMessages: number };
  auditLogs: Array<{ id: string; reason: string | null; before: { status?: string }; after: { status?: string }; createdAt: string; actor: { fullName: string; email: string } }>;
};
type UserPage = { items: AdminUser[]; total: number; page: number; limit: number; totalPages: number };
type UserAction = { user: AdminUser; action: GovernanceAction<AccountStatus> };

const ROLE_OPTIONS = [
  { value: 'ALL', label: 'Tất cả vai trò' },
  { value: 'CUSTOMER', label: 'Khách hàng' },
  { value: 'VENDOR', label: 'Nhà bán' },
  { value: 'ADMIN', label: 'Quản trị viên' },
] as const;
const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'ACTIVE', label: 'Đang hoạt động' },
  { value: 'BANNED', label: 'Đã khóa' },
] as const;

export default function AdminUsersPage() {
  const session = useSyncExternalStore(subscribeSession, getSession, () => null);
  const [result, setResult] = useState<UserPage>({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<'ALL' | UserRole>('ALL');
  const [status, setStatus] = useState<'ALL' | AccountStatus>('ALL');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<UserDetail | null>(null);
  const [action, setAction] = useState<UserAction | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) params.set('search', search);
    if (role !== 'ALL') params.set('role', role);
    if (status !== 'ALL') params.set('status', status);
    try {
      setResult(await apiRequest<UserPage>(`/admin/users?${params.toString()}`, {}, true));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể tải danh sách người dùng.');
    } finally {
      setLoading(false);
    }
  }, [page, role, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function changeSearchInput(nextInput: string) {
    setSearchInput(nextInput);
    if (shouldResetSubmittedSearch(nextInput, search)) {
      setPage(1);
      setSearch('');
    }
  }

  async function viewDetail(userId: string) {
    setDetailLoading(true);
    setError('');
    try {
      setSelected(await apiRequest<UserDetail>(`/admin/users/${userId}`, {}, true));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể tải chi tiết người dùng.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function confirmAction(reason: string) {
    if (!action) return;
    setSaving(true);
    setError('');
    try {
      await apiRequest(`/admin/users/${action.user.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: action.action.target, reason: reason || undefined }),
      }, true);
      const selectedId = selected?.id;
      setAction(null);
      await load();
      if (selectedId === action.user.id) await viewDetail(selectedId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể cập nhật tài khoản.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <section>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="eyebrow">Platform governance</p><h1 className="mt-2 text-3xl font-black tracking-[-0.035em]">Quản lý người dùng</h1><p className="mt-2 text-sm text-[var(--muted)]">Tìm kiếm tài khoản, kiểm tra hoạt động và khóa/mở quyền truy cập có audit.</p></div>
          <button type="button" className="button-ghost self-start" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Làm mới</button>
        </div>

        <div className="surface-card mt-6 grid gap-3 p-4 lg:grid-cols-[minmax(260px,1fr)_220px_220px]">
          <form className="flex items-end gap-2" onSubmit={submitSearch}><label className="grid flex-1 gap-1.5 text-sm font-semibold">Tìm kiếm<input className="h-12 rounded-xl border border-[var(--line)] px-3.5 font-normal" value={searchInput} onChange={(event) => changeSearchInput(event.target.value)} maxLength={100} placeholder="Tên, email hoặc số điện thoại" /></label><button type="submit" className="button-primary !h-12"><Search size={16} /><span className="hidden sm:inline">Tìm</span></button></form>
          <SelectMenu label="Vai trò" value={role} options={[...ROLE_OPTIONS]} onChange={(value) => { setRole(value); setPage(1); }} />
          <SelectMenu label="Trạng thái" value={status} options={[...STATUS_OPTIONS]} onChange={(value) => { setStatus(value); setPage(1); }} />
        </div>

        {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-4 flex items-center justify-between text-sm text-[var(--muted)]"><span><strong className="text-[var(--foreground)]">{result.total}</strong> tài khoản</span><span>Trang {result.page}/{Math.max(result.totalPages, 1)}</span></div>

        <div className="mt-3 grid gap-3">
          {loading ? <LoadingRows /> : result.items.map((user) => {
            const nextAction = userStatusAction(user.status);
            const isCurrentAccount = session?.user.id === user.id;
            return <article key={user.id} className="surface-card grid gap-4 p-4 lg:grid-cols-[minmax(0,1.5fr)_140px_190px_auto] lg:items-center"><div className="flex min-w-0 items-center gap-3"><Avatar name={user.fullName} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-extrabold">{user.fullName}</h2>{isCurrentAccount ? <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">Bạn</span> : null}</div><p className="truncate text-sm text-[var(--muted)]">{user.email}{user.phone ? ` · ${user.phone}` : ''}</p></div></div><div><p className="text-xs text-[var(--muted)]">Vai trò</p><p className="mt-1 text-sm font-bold">{USER_ROLE_LABELS[user.role]}</p></div><div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]"><span>{user._count.shops} shop</span><span>·</span><span>{user._count.orders} đơn</span><span>·</span><span>{user._count.reviews} đánh giá</span></div><div className="flex flex-wrap items-center gap-2 lg:justify-end"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(user.status)}`}>{ACCOUNT_STATUS_LABELS[user.status]}</span><button type="button" className="icon-button !h-9 !w-9" onClick={() => void viewDetail(user.id)} aria-label={`Xem ${user.fullName}`}><Eye size={16} /></button>{!isCurrentAccount ? <button type="button" className={nextAction.destructive ? 'rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700' : 'button-soft !min-h-9 !px-3 !py-2 text-xs'} onClick={() => setAction({ user, action: nextAction })}>{nextAction.target === 'BANNED' ? <Ban size={14} className="inline" /> : <UserCheck size={14} className="inline" />} <span className="ml-1">{nextAction.label}</span></button> : null}</div></article>;
          })}
          {!loading && result.items.length === 0 ? <div className="surface-card grid min-h-52 place-items-center p-8 text-center"><div><UsersRound className="mx-auto text-[var(--muted)]" size={30} /><h2 className="mt-3 font-extrabold">Không tìm thấy tài khoản</h2><p className="mt-1 text-sm text-[var(--muted)]">Thử thay đổi từ khóa hoặc bộ lọc.</p></div></div> : null}
        </div>

        <Pagination page={result.page} totalPages={result.totalPages} onPage={setPage} />
        {detailLoading ? <p className="mt-5 text-sm text-[var(--muted)]">Đang tải chi tiết…</p> : selected ? <UserDetailPanel user={selected} onClose={() => setSelected(null)} /> : null}
      </section>
      {action ? <AdminActionDialog title={action.action.title} description={action.action.description} confirmLabel={action.action.label} reasonRequired={action.action.reasonRequired} destructive={action.action.destructive} loading={saving} onClose={() => setAction(null)} onConfirm={(reason) => void confirmAction(reason)} /> : null}
    </AppShell>
  );
}

function UserDetailPanel({ user, onClose }: { user: UserDetail; onClose: () => void }) {
  return <section className="surface-card mt-5 p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="eyebrow">Chi tiết tài khoản</p><h2 className="mt-2 text-xl font-black">{user.fullName}</h2><p className="mt-1 text-sm text-[var(--muted)]">Tạo ngày {new Date(user.createdAt).toLocaleString('vi-VN')}</p></div><button type="button" className="button-ghost !min-h-9 !px-3" onClick={onClose}>Đóng</button></div><div className="mt-5 grid gap-3 sm:grid-cols-4"><Metric icon={Store} label="Địa chỉ" value={user._count.addresses} /><Metric icon={ShieldCheck} label="Đơn hàng" value={user._count.orders} /><Metric icon={UsersRound} label="Đánh giá" value={user._count.reviews} /><Metric icon={UserCheck} label="Tin đã gửi" value={user._count.chatMessages} /></div><div className="mt-6 grid gap-5 lg:grid-cols-2"><div><h3 className="font-extrabold">Cửa hàng sở hữu</h3><div className="mt-3 grid gap-2">{user.shops.length ? user.shops.map((shop) => <div key={shop.id} className="rounded-xl bg-[#f5f8f6] p-3"><div className="flex justify-between gap-2"><strong>{shop.name}</strong><span className="text-xs font-bold">{governanceStatusLabel(shop.status)}</span></div><p className="mt-1 text-xs text-[var(--muted)]">/{shop.slug}</p></div>) : <p className="text-sm text-[var(--muted)]">Chưa sở hữu cửa hàng.</p>}</div></div><div><h3 className="font-extrabold">Lịch sử xử lý gần đây</h3><div className="mt-3 grid gap-2">{user.auditLogs.length ? user.auditLogs.map((log) => <div key={log.id} className="rounded-xl border border-[var(--line)] p-3 text-sm"><strong>{governanceStatusLabel(log.before.status)} → {governanceStatusLabel(log.after.status)}</strong><p className="mt-1 text-xs text-[var(--muted)]">{log.reason || 'Không ghi lý do'} · {log.actor.fullName} · {new Date(log.createdAt).toLocaleString('vi-VN')}</p></div>) : <p className="text-sm text-[var(--muted)]">Chưa có thao tác quản trị.</p>}</div></div></div></section>;
}

function Avatar({ name }: { name: string }) { const value = name.split(/\s+/).filter(Boolean).slice(-2).map((item) => item[0]).join('').toUpperCase() || 'U'; return <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#123b31] text-xs font-black text-emerald-200">{value}</span>; }
function Metric({ icon: Icon, label, value }: { icon: typeof Store; label: string; value: number }) { return <div className="rounded-xl bg-[#f5f8f6] p-3"><Icon className="text-[var(--accent)]" size={17} /><p className="mt-2 text-xl font-black">{value}</p><p className="text-xs text-[var(--muted)]">{label}</p></div>; }
function LoadingRows() { return <>{[1, 2, 3].map((item) => <div key={item} className="surface-card h-24 animate-pulse bg-white" />)}</>; }
function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) { if (totalPages <= 1) return null; return <div className="mt-5 flex justify-center gap-2"><button type="button" className="button-ghost !h-10 !px-3" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={16} /> Trước</button><button type="button" className="button-ghost !h-10 !px-3" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Sau <ChevronRight size={16} /></button></div>; }
