import { AppShell } from '@/components/AppShell';
import { ArrowRight, BadgePercent, FolderTree, RotateCcw, ShieldCheck, Store, UserCog } from 'lucide-react';
import Link from 'next/link';

const ADMIN_OPERATIONS = [
  { href: '/admin/shops', title: 'Duyệt cửa hàng', description: 'Kiểm tra hồ sơ và quyết định approve hoặc reject.', icon: Store, tone: 'bg-blue-100 text-blue-700' },
  { href: '/admin/categories', title: 'Quản trị danh mục', description: 'Xây dựng cấu trúc danh mục và kiểm soát trạng thái.', icon: FolderTree, tone: 'bg-emerald-100 text-emerald-700' },
  { href: '/admin/coupons', title: 'Coupon toàn sàn', description: 'Thiết lập chiến dịch giảm giá và giới hạn sử dụng.', icon: BadgePercent, tone: 'bg-violet-100 text-violet-700' },
  { href: '/admin/refunds', title: 'Vận hành hoàn tiền', description: 'Tạo và đối soát giao dịch hoàn tiền theo payment.', icon: RotateCcw, tone: 'bg-amber-100 text-amber-700' },
];

export default function AdminPage() {
  return (
    <AppShell>
      <section className="overflow-hidden rounded-3xl border border-[#cfe3da] bg-[#e5f3ed] px-6 py-8 sm:px-9">
        <div className="flex flex-col justify-between gap-7 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-xs font-extrabold text-[var(--accent-strong)]"><ShieldCheck size={14} /> ADMIN CONTROL CENTER</span>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.035em] sm:text-4xl">Kiểm soát hoạt động nền tảng</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#4d6a60]">Workspace dành riêng cho Admin để quản trị nhà bán, taxonomy, coupon và luồng hoàn tiền.</p>
          </div>
          <Link href="/admin/shops" className="button-primary h-12 shrink-0">Mở hàng chờ duyệt <ArrowRight size={17} /></Link>
        </div>
      </section>

      <section className="mt-7">
        <div className="flex items-end justify-between gap-4">
          <div><p className="eyebrow">Nghiệp vụ quản trị</p><h2 className="mt-2 text-2xl font-black tracking-[-0.025em]">Trung tâm điều hành</h2></div>
          <span className="hidden items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--muted)] sm:flex"><UserCog size={15} /> Quyền ADMIN</span>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {ADMIN_OPERATIONS.map(({ href, title, description, icon: Icon, tone }) => (
            <Link key={href} href={href} className="surface-card group p-5 transition duration-200 hover:-translate-y-1 hover:border-[#b9d1c6] hover:shadow-[var(--shadow-md)]">
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}><Icon size={21} /></span>
              <h3 className="mt-5 text-base font-extrabold">{title}</h3>
              <p className="mt-2 min-h-12 text-sm leading-6 text-[var(--muted)]">{description}</p>
              <span className="mt-5 flex items-center gap-1 text-sm font-bold text-[var(--accent)]">Đi đến chức năng <ArrowRight className="transition group-hover:translate-x-1" size={15} /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-7 grid gap-4 lg:grid-cols-3">
        <div className="surface-card p-6 lg:col-span-2"><p className="eyebrow">Thứ tự ưu tiên</p><h2 className="mt-2 text-xl font-black">Checklist vận hành đề xuất</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{['Xử lý hồ sơ cửa hàng đang chờ', 'Kiểm tra danh mục trước khi khóa', 'Theo dõi giới hạn coupon', 'Đối soát trạng thái refund'].map((item, index) => <div key={item} className="flex items-center gap-3 rounded-xl bg-[#f5f8f6] p-3.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-xs font-black text-[var(--accent)] shadow-sm">{index + 1}</span><span className="text-sm font-bold">{item}</span></div>)}</div></div>
        <div className="rounded-2xl bg-[#182e28] p-6 text-white shadow-[var(--shadow-sm)]"><ShieldCheck className="text-emerald-300" size={28} /><h2 className="mt-4 text-xl font-black">Phân quyền hai lớp</h2><p className="mt-2 text-sm leading-6 text-white/60">Giao diện chỉ hiển thị đúng workspace; API tiếp tục xác thực JWT và RBAC cho mọi thao tác nhạy cảm.</p></div>
      </section>
    </AppShell>
  );
}
