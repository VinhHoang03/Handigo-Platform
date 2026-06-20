export interface NavItem {
  icon: string;
  label: string;
  path: string;
  matchPrefix?: boolean;
}

export type DashboardRole = 'CUSTOMER' | 'PROVIDER' | 'ADMIN';

export const customerNavItems: NavItem[] = [
  { icon: 'dashboard', label: 'Bảng điều khiển', path: '/customer' },
  { icon: 'calendar_today', label: 'Lịch đặt chỗ', path: '/customer/bookings', matchPrefix: true },
  { icon: 'mail', label: 'Hộp thư', path: '#' },
  { icon: 'account_balance_wallet', label: 'Ví tiền', path: '/customer/wallet' },
  { icon: 'settings', label: 'Cài đặt', path: '/customer/profile' },
];

export const providerNavItems: NavItem[] = [
  { icon: 'grid_view', label: 'Tổng quan', path: '/provider' },
  { icon: 'receipt_long', label: 'Đơn dịch vụ', path: '/provider/orders', matchPrefix: true },
  { icon: 'event_available', label: 'Lịch làm việc', path: '#' },
  { icon: 'payments', label: 'Ví', path: '/provider/wallet' },
  { icon: 'account_balance', label: 'Tài khoản ngân hàng', path: '/provider/bank-accounts' },
  { icon: 'reviews', label: 'Đánh giá', path: '/provider/feedbacks' },
  { icon: 'mail', label: 'Tin nhắn', path: '#' },
  { icon: 'settings', label: 'Hồ sơ dịch vụ', path: '/provider/profile' },
];

export const adminNavItems: NavItem[] = [
  { icon: 'people', label: 'Người dùng', path: '/admin/users' },
  { icon: 'notifications', label: 'Thông báo', path: '/admin/notifications' },
  { icon: 'verified_user', label: 'Hồ sơ thợ', path: '/admin/provider-applications' },
  { icon: 'reviews', label: 'Đánh giá', path: '/admin/feedbacks' },
  { icon: 'local_offer', label: 'Khuyến mãi', path: '/admin/promotions' },
  { icon: 'settings', label: 'Cấu hình hệ thống', path: '/admin/system-configs' },
];

export function getNavItemsForRole(role: DashboardRole): NavItem[] {
  switch (role) {
    case 'ADMIN':
      return adminNavItems;
    case 'PROVIDER':
      return providerNavItems;
    default:
      return customerNavItems;
  }
}

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.path === '#') return false;
  return item.matchPrefix ? pathname.startsWith(item.path) : pathname === item.path;
}

export const roleSwitchConfig: Record<
  DashboardRole,
  { label: string; path: string; variant: 'outline' | 'gradient' }
> = {
  CUSTOMER: { label: 'Đăng tin dịch vụ', path: '/register-provider', variant: 'gradient' },
  PROVIDER: { label: 'Chuyển sang Khách hàng', path: '/', variant: 'outline' },
  ADMIN: { label: 'Về trang chủ', path: '/', variant: 'outline' },
};
