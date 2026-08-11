import { AppShell } from '@/components/AppShell';
import { ArrowRight, BadgePercent, Box, CheckCircle2, ClipboardList, Store, TrendingUp } from 'lucide-react';
import Link from 'next/link';

const OPERATIONS = [
  { href: '/vendor/shop', title: 'Hồ sơ cửa hàng', description: 'Theo dõi trạng thái duyệt và thông tin gian hàng.', icon: Store, tone: 'bg-sky-100 text-sky-700' },
  { href: '/vendor/products', title: 'Quản lý sản phẩm', description: 'Tạo sản phẩm, cập nhật tồn kho và trạng thái bán.', icon: Box, tone: 'bg-emerald-100 text-emerald-700' },
  { href: '/vendor/orders', title: 'Xử lý đơn bán', description: 'Xác nhận, đóng gói, bàn giao hoặc hủy đơn.', icon: ClipboardList, tone: 'bg-amber-100 text-amber-700' },
  { href: '/vendor/coupons', title: 'Khuyến mãi', description: 'Tạo coupon riêng cho cửa hàng và quản lý chiến dịch.', icon: BadgePercent, tone: 'bg-violet-100 text-violet-700' },
];

export default function VendorPage() {
  return (
    <AppShell>
      <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-[#123b31] to-[#1b5b4a] px-6 py-8 text-white shadow-[var(--shadow-md)] sm:px-9">
        <div className="flex flex-col justify-between gap-7 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <p className="text-xs font-extrabold tracking-[0.16em] text-emerald-300">VENDOR OVERVIEW</p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.035em] sm:text-4xl">Vận hành cửa hàng của bạn</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/65">Quản lý sản phẩm, tồn kho, đơn bán và chương trình khuyến mãi trong một workspace tách biệt.</p>
          </div>
          <Link href="/vendor/products" className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 text-sm font-extrabold text-[#123b31] transition hover:bg-emerald-200">Quản lý sản phẩm <ArrowRight size={17} /></Link>
        </div>
      </section>

      <section className="mt-7">
        <div className="flex items-end justify-between gap-4">
          <div><p className="eyebrow">Công việc hằng ngày</p><h2 className="mt-2 text-2xl font-black tracking-[-0.025em]">Khu vực vận hành</h2></div>
          <span className="hidden items-center gap-2 text-sm font-semibold text-[var(--muted)] sm:flex"><TrendingUp size={16} /> Đúng vai trò Vendor</span>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {OPERATIONS.map(({ href, title, description, icon: Icon, tone }) => (
            <Link key={href} href={href} className="surface-card group p-5 transition duration-200 hover:-translate-y-1 hover:border-[#b9d1c6] hover:shadow-[var(--shadow-md)]">
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}><Icon size={21} /></span>
              <h3 className="mt-5 text-base font-extrabold">{title}</h3>
              <p className="mt-2 min-h-12 text-sm leading-6 text-[var(--muted)]">{description}</p>
              <span className="mt-5 flex items-center gap-1 text-sm font-bold text-[var(--accent)]">Mở chức năng <ArrowRight className="transition group-hover:translate-x-1" size={15} /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="surface-card mt-7 grid gap-6 p-6 lg:grid-cols-[0.8fr_1.2fr] lg:p-8">
        <div><p className="eyebrow">Luồng bán hàng</p><h2 className="mt-2 text-2xl font-black tracking-[-0.025em]">Từ gian hàng đến giao hàng</h2><p className="mt-3 text-sm leading-6 text-[var(--muted)]">Mỗi bước được kiểm soát bằng quyền Vendor và trạng thái nghiệp vụ ở backend.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {['Hoàn thiện hồ sơ cửa hàng', 'Đăng bán và cập nhật tồn kho', 'Xác nhận, đóng gói đơn hàng', 'Theo dõi doanh thu và khuyến mãi'].map((step, index) => (
            <div key={step} className="flex items-center gap-3 rounded-xl bg-[#f5f8f6] p-3.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-black text-[var(--accent)] shadow-sm">{index + 1}</span><span className="text-sm font-bold">{step}</span>{index === 0 ? <CheckCircle2 className="ml-auto text-emerald-600" size={17} /> : null}</div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
