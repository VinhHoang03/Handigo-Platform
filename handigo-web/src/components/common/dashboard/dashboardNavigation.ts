import type {
  DashboardNavItem,
  DashboardRole,
  DashboardSwitchConfig,
} from "./dashboard.types";

export const dashboardHomePath: Record<DashboardRole, string> = {
  CUSTOMER: "/customer",
  PROVIDER: "/provider",
  ADMIN: "/admin",
};

export const dashboardSubtitle: Record<DashboardRole, string> = {
  CUSTOMER: "Dịch vụ tại nhà",
  PROVIDER: "Nhà cung cấp",
  ADMIN: "Quản trị hệ thống",
};

export const providerNavItems: DashboardNavItem[] = [
  { icon: "grid_view", label: "Tổng quan", path: "/provider" },
  {
    icon: "receipt_long",
    label: "Đơn dịch vụ",
    path: "/provider/orders",
    matchPrefix: true,
  },
  { icon: "event_available", label: "Lịch làm việc", path: "/provider/schedule" },
  { icon: "payments", label: "Ví", path: "/provider/wallet" },
  {
    icon: "account_balance",
    label: "Tài khoản ngân hàng",
    path: "/provider/bank-accounts",
  },
  { icon: "reviews", label: "Đánh giá", path: "/provider/feedbacks" },
  {
    icon: "lightbulb",
    label: "Đề xuất dịch vụ",
    path: "/provider/service-suggestions",
  },
  {
    icon: "support_agent",
    label: "Khiếu nại, hỗ trợ & báo cáo",
    path: "/provider/support",
  },
  { icon: "settings", label: "Hồ sơ dịch vụ", path: "/provider/profile" },
];

export const adminNavItems: DashboardNavItem[] = [
  { icon: "dashboard", label: "Tổng quan", path: "/admin" },
  { icon: "people", label: "Người dùng", path: "/admin/users" },
  {
    icon: "verified_user",
    label: "Hồ sơ xét duyệt",
    path: "/admin/provider-applications",
  },
  { icon: "reviews", label: "Đánh giá", path: "/admin/feedbacks" },
  { icon: "category", label: "Danh mục dịch vụ", path: "/admin/categories" },
  { icon: "construction", label: "Dịch vụ", path: "/admin/services" },
  {
    icon: "lightbulb",
    label: "Đề xuất dịch vụ",
    path: "/admin/service-suggestions",
  },
  { icon: "local_offer", label: "Khuyến mãi", path: "/admin/promotions" },
  {
    icon: "account_balance_wallet",
    label: "Rút tiền",
    path: "/admin/withdrawals",
  },
  { icon: "support_agent", label: "Yêu cầu hỗ trợ", path: "/admin/support" },
  { icon: "gavel", label: "Khiếu nại & vi phạm", path: "/admin/cases" },
  { icon: "receipt_long", label: "Thanh toán", path: "/admin/payments" },
  { icon: "account_balance_wallet", label: "Ví provider", path: "/admin/wallets" },
  { icon: "notifications", label: "Thông báo", path: "/admin/notifications" },
  { icon: "payments", label: "Doanh thu hệ thống", path: "/admin/revenue" },
  {
    icon: "settings",
    label: "Cấu hình hệ thống",
    path: "/admin/system-configs",
  },
];

export const roleSwitchConfig: Record<DashboardRole, DashboardSwitchConfig> = {
  CUSTOMER: {
    label: "Đăng tin dịch vụ",
    path: "/register-provider",
    variant: "gradient",
  },
  PROVIDER: {
    label: "Chuyển sang Khách hàng",
    path: "/",
    variant: "outline",
  },
  ADMIN: { label: "Về trang chủ", path: "/", variant: "outline" },
};

export function getNavItemsForRole(role: DashboardRole): DashboardNavItem[] {
  switch (role) {
    case "ADMIN":
      return adminNavItems;
    case "PROVIDER":
      return providerNavItems;
    default:
      return [];
  }
}

export function isNavItemActive(
  pathname: string,
  item: DashboardNavItem,
): boolean {
  if (item.path === "#") return false;
  return item.matchPrefix
    ? pathname.startsWith(item.path)
    : pathname === item.path;
}
