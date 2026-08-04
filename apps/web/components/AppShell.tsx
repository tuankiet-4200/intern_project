import { BarChart3, Boxes, LayoutDashboard, PackageSearch, ReceiptText, ShoppingCart, Store, UserRound } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

const navItems = [
  { href: '/', label: 'Market', icon: PackageSearch },
  { href: '/cart', label: 'Cart', icon: ShoppingCart },
  { href: '/orders', label: 'Orders', icon: ReceiptText },
  { href: '/vendor', label: 'Vendor', icon: Store },
  { href: '/admin', label: 'Admin', icon: LayoutDashboard },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--panel)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Boxes size={22} />
            Intern Commerce
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex h-10 items-center gap-2 rounded-md px-3 text-sm text-[var(--muted)] hover:bg-[#eeeeE8] hover:text-[var(--foreground)]"
              >
                <item.icon size={17} />
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/profile" className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--line)] bg-white" aria-label="Account">
            <UserRound size={18} />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      <footer className="border-t border-[var(--line)] py-5 text-center text-sm text-[var(--muted)]">
        Phase 3 commerce: cart, checkout, split orders, inventory reservation and payment tracking.
      </footer>
    </div>
  );
}

export function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof BarChart3 }) {
  return (
    <div className="rounded-md border border-[var(--line)] bg-white p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-[#e2f3f0] text-[var(--accent-strong)]">
        <Icon size={18} />
      </div>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-[var(--muted)]">{label}</div>
    </div>
  );
}
