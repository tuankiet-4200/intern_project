export type AccountStatus = 'ACTIVE' | 'BANNED';
export type UserRole = 'CUSTOMER' | 'VENDOR' | 'ADMIN';
export type ShopStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export type GovernanceAction<T extends string> = {
  target: T;
  label: string;
  title: string;
  description: string;
  reasonRequired: boolean;
  destructive?: boolean;
};

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  ACTIVE: 'Đang hoạt động',
  BANNED: 'Đã khóa',
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  CUSTOMER: 'Khách hàng',
  VENDOR: 'Nhà bán',
  ADMIN: 'Quản trị viên',
};

export const SHOP_STATUS_LABELS: Record<ShopStatus, string> = {
  PENDING_REVIEW: 'Chờ duyệt',
  APPROVED: 'Đang hoạt động',
  REJECTED: 'Đã từ chối',
  SUSPENDED: 'Đang đình chỉ',
};

export function userStatusAction(status: AccountStatus): GovernanceAction<AccountStatus> {
  return status === 'ACTIVE'
    ? {
      target: 'BANNED', label: 'Khóa tài khoản', title: 'Khóa tài khoản này?',
      description: 'Phiên đăng nhập sẽ bị thu hồi và các cửa hàng đang hoạt động của user sẽ bị đình chỉ.',
      reasonRequired: true, destructive: true,
    }
    : {
      target: 'ACTIVE', label: 'Mở khóa', title: 'Mở khóa tài khoản?',
      description: 'User có thể đăng nhập lại. Các cửa hàng đã bị đình chỉ vẫn cần được Admin khôi phục riêng.',
      reasonRequired: false,
    };
}

export function shopStatusActions(status: ShopStatus): GovernanceAction<ShopStatus>[] {
  if (status === 'PENDING_REVIEW') return [
    { target: 'APPROVED', label: 'Phê duyệt', title: 'Phê duyệt cửa hàng?', description: 'Cửa hàng và sản phẩm ACTIVE có tồn kho sẽ được phép hiển thị công khai.', reasonRequired: false },
    { target: 'REJECTED', label: 'Từ chối', title: 'Từ chối cửa hàng?', description: 'Hồ sơ sẽ bị từ chối và nhà bán nhận thông báo trạng thái.', reasonRequired: true, destructive: true },
  ];
  if (status === 'APPROVED') return [
    { target: 'SUSPENDED', label: 'Đình chỉ', title: 'Đình chỉ cửa hàng?', description: 'Cửa hàng và toàn bộ sản phẩm sẽ biến mất khỏi marketplace ngay lập tức.', reasonRequired: true, destructive: true },
  ];
  if (status === 'SUSPENDED') return [
    { target: 'APPROVED', label: 'Khôi phục', title: 'Khôi phục cửa hàng?', description: 'Cửa hàng sẽ hoạt động trở lại nếu tài khoản chủ shop vẫn đang ACTIVE.', reasonRequired: false },
    { target: 'REJECTED', label: 'Từ chối', title: 'Chuyển cửa hàng sang từ chối?', description: 'Cửa hàng phải nộp lại hồ sơ trước khi có thể được duyệt lần nữa.', reasonRequired: true, destructive: true },
  ];
  return [
    { target: 'PENDING_REVIEW', label: 'Mở lại hồ sơ', title: 'Đưa về hàng chờ duyệt?', description: 'Hồ sơ sẽ quay lại trạng thái chờ để Admin đánh giá lại.', reasonRequired: false },
  ];
}

export function statusTone(status: AccountStatus | ShopStatus) {
  if (status === 'ACTIVE' || status === 'APPROVED') return 'bg-emerald-100 text-emerald-800';
  if (status === 'PENDING_REVIEW') return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

export function governanceStatusLabel(status?: string) {
  if (!status) return 'Không xác định';
  if (status in ACCOUNT_STATUS_LABELS) return ACCOUNT_STATUS_LABELS[status as AccountStatus];
  if (status in SHOP_STATUS_LABELS) return SHOP_STATUS_LABELS[status as ShopStatus];
  return status;
}
