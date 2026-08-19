'use client';

import {
  Bell,
  Boxes,
  ChevronRight,
  CircleDollarSign,
  FolderTree,
  Home,
  Heart,
  LayoutGrid,
  MessageCircle,
  PackageSearch,
  ReceiptText,
  ShoppingBag,
  ShoppingCart,
  Store,
  Tags,
  UserRound,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ChatWidget } from '@/components/ChatWidget';
import { apiRequest, getSession, restoreSession, subscribeSession, type Session } from '@/lib/api';
import {
  formatCartBadgeCount,
  getCartItemCount,
  resetCartItemCount,
  setCartItemCount,
  subscribeCartItemCount,
} from '@/lib/cart-indicator';
import {
  formatWishlistBadgeCount,
  getWishlistItemCount,
  resetWishlistItemCount,
  setWishlistItemCount,
  subscribeWishlistItemCount,
} from '@/lib/wishlist-indicator';
import {
  canAccessPath,
  isNavigationItemActive,
  navigationFor,
  resolveSurface,
  workspaceHref,
  type NavigationIcon,
  type NavigationItem,
} from '@/lib/navigation';

const ICONS: Record<NavigationIcon, typeof Home> = {
  home: Home,
  cart: ShoppingCart,
  orders: ReceiptText,
  bell: Bell,
  message: MessageCircle,
  shop: Store,
  products: PackageSearch,
  coupon: Tags,
  category: FolderTree,
  refund: CircleDollarSign,
  users: UsersRound,
  heart: Heart,
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const surface = resolveSurface(pathname);
  const session = useSyncExternalStore(subscribeSession, getSession, () => null);
  const cartItemCount = useSyncExternalStore(subscribeCartItemCount, getCartItemCount, () => 0);
  const wishlistItemCount = useSyncExternalStore(subscribeWishlistItemCount, getWishlistItemCount, () => 0);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    void restoreSession().then(() => {
      setSessionReady(true);
    });
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    if (!session || session.user.role === 'ADMIN') {
      resetCartItemCount();
      resetWishlistItemCount();
      return;
    }
    // Do not display the previous account's shopping counts while the new account loads.
    resetCartItemCount();
    resetWishlistItemCount();
    let active = true;
    Promise.allSettled([
      apiRequest<{ itemCount: number }>('/cart', {}, true),
      apiRequest<{ productIds: string[] }>('/wishlist/product-ids', {}, true),
    ]).then(([cartResult, wishlistResult]) => {
      if (!active) return;
      if (cartResult.status === 'fulfilled') setCartItemCount(cartResult.value.itemCount);
      else resetCartItemCount();
      if (wishlistResult.status === 'fulfilled') setWishlistItemCount(wishlistResult.value.productIds.length);
      else resetWishlistItemCount();
    });
    return () => { active = false; };
  }, [session, sessionReady]);

  const navigation = useMemo(
    () => navigationFor(surface, session?.user.role),
    [session?.user.role, surface],
  );
  const content = sessionReady && !canAccessPath(pathname, session?.user.role)
    ? <AccessState session={session} />
    : !sessionReady && surface !== 'customer' && surface !== 'auth'
      ? <ShellLoading />
      : children;

  if (surface === 'admin' || surface === 'vendor') {
    return (
      <WorkspaceShell
        surface={surface}
        pathname={pathname}
        navigation={navigation}
        session={session}
      >
        {content}
      </WorkspaceShell>
    );
  }

  return (
    <StorefrontShell pathname={pathname} navigation={navigation} session={session} authOnly={surface === 'auth'} cartItemCount={cartItemCount} wishlistItemCount={wishlistItemCount}>
      {content}
    </StorefrontShell>
  );
}

function StorefrontShell({
  children,
  pathname,
  navigation,
  session,
  authOnly,
  cartItemCount,
  wishlistItemCount,
}: {
  children: ReactNode;
  pathname: string;
  navigation: NavigationItem[];
  session: Session | null;
  authOnly: boolean;
  cartItemCount: number;
  wishlistItemCount: number;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-5 px-4 sm:px-6 lg:px-8">
          <Brand />
          {!authOnly ? (
            <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Điều hướng khách hàng">
              {navigation.map((item) => <TopNavigationLink key={item.href} item={item} pathname={pathname} cartItemCount={cartItemCount} wishlistItemCount={wishlistItemCount} />)}
            </nav>
          ) : <div className="ml-auto" />}
          <AccountActions session={session} authOnly={authOnly} />
        </div>
      </header>

      <main className={authOnly ? 'min-h-[calc(100vh-72px)]' : 'mx-auto min-h-[calc(100vh-148px)] max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8 lg:py-10'}>
        {children}
      </main>

      {!authOnly ? (
        <nav className="fixed inset-x-3 bottom-3 z-40 grid rounded-2xl border border-white/70 bg-[#142a25]/95 p-1.5 text-white shadow-2xl backdrop-blur md:hidden" style={{ gridTemplateColumns: `repeat(${Math.max(navigation.length, 1)}, minmax(0, 1fr))` }} aria-label="Điều hướng di động">
          {navigation.map((item) => <MobileNavigationLink key={item.href} item={item} pathname={pathname} cartItemCount={cartItemCount} wishlistItemCount={wishlistItemCount} />)}
        </nav>
      ) : null}
      {!authOnly ? (
        <footer className="hidden border-t border-[var(--line)] bg-white py-6 text-center text-sm text-[var(--muted)] md:block">
          Mua sắm an tâm từ những cửa hàng đã được kiểm duyệt.
        </footer>
      ) : null}
      {!authOnly && session && session.user.role !== 'ADMIN' && pathname !== '/messages' ? <ChatWidget session={session} mode="CUSTOMER" /> : null}
    </div>
  );
}

function WorkspaceShell({
  children,
  surface,
  pathname,
  navigation,
  session,
}: {
  children: ReactNode;
  surface: 'admin' | 'vendor';
  pathname: string;
  navigation: NavigationItem[];
  session: Session | null;
}) {
  const title = surface === 'admin' ? 'Trung tâm quản trị' : 'Kênh người bán';
  const eyebrow = surface === 'admin' ? 'ADMIN WORKSPACE' : 'VENDOR WORKSPACE';

  return (
    <div className="min-h-screen bg-[#f3f5f2] lg:grid lg:grid-cols-[272px_1fr]">
      <aside className="hidden min-h-screen flex-col bg-[#102722] px-4 py-5 text-white lg:flex">
        <div className="px-2"><Brand inverse /></div>
        <div className="mt-8 px-3">
          <p className="text-[10px] font-bold tracking-[0.2em] text-emerald-300/70">{eyebrow}</p>
          <p className="mt-1 text-sm font-semibold">{title}</p>
        </div>
        <nav className="mt-5 grid gap-1" aria-label={title}>
          {navigation.map((item) => <WorkspaceNavigationLink key={item.href} item={item} pathname={pathname} />)}
        </nav>
        <div className="mt-auto grid gap-3">
          <Link href="/" className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-emerald-50 transition hover:bg-white/10">
            <span className="flex items-center gap-2"><ShoppingBag size={16} /> Xem gian hàng</span>
            <ChevronRight size={15} />
          </Link>
          <WorkspaceAccount session={session} />
        </div>
      </aside>

      <section className="min-w-0">
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-[var(--line)] bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="lg:hidden"><Brand /></div>
          <div className="hidden lg:block">
            <p className="text-xs font-bold tracking-[0.14em] text-[var(--muted)]">{eyebrow}</p>
            <p className="text-sm font-semibold">{title}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/notifications" className="icon-button" aria-label="Thông báo"><Bell size={18} /></Link>
            <Link href="/profile" className="icon-button" aria-label="Tài khoản"><UserRound size={18} /></Link>
          </div>
        </header>

        <nav className="flex gap-2 overflow-x-auto border-b border-[var(--line)] bg-white px-4 py-3 lg:hidden" aria-label={title}>
          {navigation.map((item) => <WorkspaceNavigationLink key={item.href} item={item} pathname={pathname} compact />)}
        </nav>
        <main className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6 lg:px-8 lg:py-9">{children}</main>
      </section>
      {surface === 'vendor' && session?.user.role === 'VENDOR' && pathname !== '/vendor/messages' ? <ChatWidget session={session} mode="SHOP" /> : null}
    </div>
  );
}

function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Intern Market">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${inverse ? 'bg-emerald-300 text-[#102722]' : 'bg-[var(--accent)] text-white'}`}>
        <Boxes size={21} strokeWidth={2.2} />
      </span>
      <span>
        <span className={`block text-[15px] font-extrabold tracking-[-0.02em] ${inverse ? 'text-white' : 'text-[var(--foreground)]'}`}>Intern Market</span>
        <span className={`block text-[10px] font-semibold uppercase tracking-[0.16em] ${inverse ? 'text-emerald-200/65' : 'text-[var(--muted)]'}`}>Multi-vendor commerce</span>
      </span>
    </Link>
  );
}

function AccountActions({ session, authOnly }: { session: Session | null; authOnly: boolean }) {
  if (!session) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        {!authOnly ? <Link href="/login" className="button-ghost hidden sm:inline-flex">Đăng nhập</Link> : <Link href="/" className="button-ghost">Về cửa hàng</Link>}
        {!authOnly ? <Link href="/register" className="button-primary">Tạo tài khoản</Link> : null}
      </div>
    );
  }
  return (
    <div className="flex shrink-0 items-center gap-2">
      {session.user.role !== 'CUSTOMER' ? (
        <Link href={workspaceHref(session.user.role)} className="button-soft hidden xl:inline-flex">
          <LayoutGrid size={16} /> Workspace
        </Link>
      ) : (
        <Link href="/vendor/shop" className="button-soft hidden xl:inline-flex"><Store size={16} /> Kênh người bán</Link>
      )}
      <Link href="/profile" className="flex h-11 items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-2.5 transition hover:border-[var(--accent)]" aria-label="Tài khoản">
        <UserAvatar name={session.user.fullName} />
        <span className="hidden max-w-28 truncate text-sm font-semibold sm:block">{session.user.fullName}</span>
      </Link>
    </div>
  );
}

function WorkspaceAccount({ session }: { session: Session | null }) {
  return (
    <Link href="/profile" className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10">
      <UserAvatar name={session?.user.fullName ?? 'User'} inverse />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{session?.user.fullName ?? 'Đang xác thực…'}</span>
        <span className="block truncate text-xs text-emerald-100/55">{session?.user.email ?? 'Phiên đăng nhập'}</span>
      </span>
    </Link>
  );
}

function UserAvatar({ name, inverse = false }: { name: string; inverse?: boolean }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join('').toUpperCase() || 'U';
  return <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold ${inverse ? 'bg-emerald-300 text-[#102722]' : 'bg-emerald-100 text-emerald-800'}`}>{initials}</span>;
}

function TopNavigationLink({ item, pathname, cartItemCount, wishlistItemCount }: { item: NavigationItem; pathname: string; cartItemCount: number; wishlistItemCount: number }) {
  const Icon = ICONS[item.icon];
  const active = isNavigationItemActive(pathname, item);
  return (
    <Link href={item.href} className={`nav-link relative ${active ? 'nav-link-active' : ''}`}>
      <span className="relative">
        <Icon size={17} />
        {item.icon === 'cart' && cartItemCount > 0 ? <NavigationBadge count={cartItemCount} label="sản phẩm trong giỏ hàng" /> : null}
        {item.icon === 'heart' && wishlistItemCount > 0 ? <NavigationBadge count={wishlistItemCount} label="sản phẩm yêu thích" /> : null}
      </span>
      {item.label}
    </Link>
  );
}

function MobileNavigationLink({ item, pathname, cartItemCount, wishlistItemCount }: { item: NavigationItem; pathname: string; cartItemCount: number; wishlistItemCount: number }) {
  const Icon = ICONS[item.icon];
  const active = isNavigationItemActive(pathname, item);
  return (
    <Link href={item.href} className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold ${active ? 'bg-white text-[#153c33]' : 'text-white/65'}`}>
      <span className="relative">
        <Icon size={18} />
        {item.icon === 'cart' && cartItemCount > 0 ? <NavigationBadge count={cartItemCount} label="sản phẩm trong giỏ hàng" compact /> : null}
        {item.icon === 'heart' && wishlistItemCount > 0 ? <NavigationBadge count={wishlistItemCount} label="sản phẩm yêu thích" compact /> : null}
      </span>
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function NavigationBadge({ count, label, compact = false }: { count: number; label: string; compact?: boolean }) {
  return (
    <span className={`absolute flex items-center justify-center rounded-full bg-red-500 font-extrabold leading-none text-white ring-2 ${compact ? '-right-3 -top-2 h-4 min-w-4 px-1 text-[9px] ring-[#142a25]' : '-right-3.5 -top-2.5 h-[18px] min-w-[18px] px-1 text-[10px] ring-white'}`} aria-label={`${count} ${label}`}>
      {label.includes('yêu thích') ? formatWishlistBadgeCount(count) : formatCartBadgeCount(count)}
    </span>
  );
}

function WorkspaceNavigationLink({ item, pathname, compact = false }: { item: NavigationItem; pathname: string; compact?: boolean }) {
  const Icon = ICONS[item.icon];
  const active = isNavigationItemActive(pathname, item);
  return (
    <Link href={item.href} className={compact
      ? `flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${active ? 'bg-emerald-100 text-emerald-900' : 'bg-gray-50 text-[var(--muted)]'}`
      : `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${active ? 'bg-emerald-300 text-[#102722]' : 'text-emerald-50/70 hover:bg-white/10 hover:text-white'}`
    }>
      <Icon size={18} /> {item.label}
    </Link>
  );
}

function AccessState({ session }: { session: Session | null }) {
  return (
    <section className="mx-auto mt-12 max-w-lg rounded-3xl border border-[var(--line)] bg-white p-8 text-center shadow-[var(--shadow-sm)]">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><UserRound size={25} /></span>
      <h1 className="mt-5 text-2xl font-extrabold">Không thể truy cập khu vực này</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        {session ? `Tài khoản ${session.user.role} không có quyền truy cập trang này.` : 'Bạn cần đăng nhập bằng tài khoản phù hợp để tiếp tục.'}
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Link href={session ? workspaceHref(session.user.role) : '/login'} className="button-primary">
          {session ? 'Về workspace của tôi' : 'Đăng nhập'}
        </Link>
        <Link href="/" className="button-ghost">Về cửa hàng</Link>
      </div>
    </section>
  );
}

function ShellLoading() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="text-center"><span className="loading-spinner mx-auto" /><p className="mt-3 text-sm text-[var(--muted)]">Đang xác thực workspace…</p></div>
    </div>
  );
}
