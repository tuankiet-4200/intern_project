import type { SessionUser } from './api';

export type AppRole = SessionUser['role'];
export type AppSurface = 'customer' | 'vendor' | 'admin' | 'auth';
export type NavigationIcon = 'home' | 'cart' | 'orders' | 'bell' | 'message' | 'shop' | 'products' | 'coupon' | 'category' | 'refund' | 'users';

export type NavigationItem = {
  href: string;
  label: string;
  icon: NavigationIcon;
  exact?: boolean;
};

const CUSTOMER_NAV: NavigationItem[] = [
  { href: '/', label: 'Khám phá', icon: 'home', exact: true },
  { href: '/cart', label: 'Giỏ hàng', icon: 'cart' },
  { href: '/orders', label: 'Đơn mua', icon: 'orders' },
  { href: '/messages', label: 'Tin nhắn', icon: 'message' },
  { href: '/notifications', label: 'Thông báo', icon: 'bell' },
];

const VENDOR_NAV: NavigationItem[] = [
  { href: '/vendor', label: 'Tổng quan', icon: 'home', exact: true },
  { href: '/vendor/shop', label: 'Cửa hàng', icon: 'shop' },
  { href: '/vendor/products', label: 'Sản phẩm', icon: 'products' },
  { href: '/vendor/orders', label: 'Đơn bán', icon: 'orders' },
  { href: '/vendor/messages', label: 'Tin nhắn', icon: 'message' },
  { href: '/vendor/coupons', label: 'Khuyến mãi', icon: 'coupon' },
];

const ADMIN_NAV: NavigationItem[] = [
  { href: '/admin', label: 'Tổng quan', icon: 'home', exact: true },
  { href: '/admin/users', label: 'Người dùng', icon: 'users' },
  { href: '/admin/shops', label: 'Cửa hàng', icon: 'shop' },
  { href: '/admin/categories', label: 'Danh mục', icon: 'category' },
  { href: '/admin/coupons', label: 'Mã giảm giá', icon: 'coupon' },
  { href: '/admin/refunds', label: 'Hoàn tiền', icon: 'refund' },
];

export function resolveSurface(pathname: string): AppSurface {
  if (pathname === '/login' || pathname === '/register') return 'auth';
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/vendor')) return 'vendor';
  return 'customer';
}

export function navigationFor(surface: AppSurface, role?: AppRole): NavigationItem[] {
  if (surface === 'admin') return role === 'ADMIN' ? ADMIN_NAV : [];
  if (surface === 'vendor') {
    if (role === 'VENDOR') return VENDOR_NAV;
    if (role === 'CUSTOMER') return VENDOR_NAV.filter((item) => item.href === '/vendor/shop');
    return [];
  }
  if (surface === 'auth') return [];
  if (role === 'ADMIN') return CUSTOMER_NAV.filter((item) => item.href === '/' || item.href === '/notifications');
  return CUSTOMER_NAV;
}

export function canAccessPath(pathname: string, role?: AppRole) {
  if (pathname === '/' || pathname.startsWith('/products/') || pathname === '/login' || pathname === '/register') return true;
  if (!role) return false;
  if (pathname.startsWith('/admin')) return role === 'ADMIN';
  if (pathname === '/vendor/shop') return role === 'CUSTOMER' || role === 'VENDOR';
  if (pathname.startsWith('/vendor')) return role === 'VENDOR';
  if (pathname === '/cart' || pathname.startsWith('/orders') || pathname === '/messages') return role === 'CUSTOMER' || role === 'VENDOR';
  return true;
}

export function workspaceHref(role: AppRole) {
  if (role === 'ADMIN') return '/admin';
  if (role === 'VENDOR') return '/vendor';
  return '/vendor/shop';
}

export function isNavigationItemActive(pathname: string, item: NavigationItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
