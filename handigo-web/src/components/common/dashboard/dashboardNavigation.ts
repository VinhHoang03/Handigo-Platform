import type {
  DashboardNavItem,
  DashboardRole,
  DashboardSwitchConfig,
} from "./dashboard.types";
import { Banknote, Bell, CalendarCheck, Gavel, Grid2X2, HardHat, Landmark, LayoutDashboard, LayoutGrid, LifeBuoy, Lightbulb, Newspaper, ReceiptText, Settings, ShieldCheck, Star, Tag, Users, Wallet } from "lucide-react";

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
  { icon: LayoutGrid, label: "Tổng quan", path: "/provider" },
  {
    icon: ReceiptText,
    label: "Đơn dịch vụ",
    path: "/provider/orders",
    matchPrefix: true,
  },
  { icon: CalendarCheck, label: "Lịch làm việc", path: "/provider/schedule" },
  { icon: Banknote, label: "Ví", path: "/provider/wallet" },
  {
    icon: Landmark,
    label: "Tài khoản ngân hàng",
    path: "/provider/bank-accounts",
  },
  { icon: Star, label: "Đánh giá", path: "/provider/feedbacks" },
  {
    icon: Lightbulb,
    label: "Đề xuất dịch vụ",
    path: "/provider/service-suggestions",
  },
  {
    icon: LifeBuoy,
    label: "Khiếu nại, hỗ trợ & báo cáo",
    path: "/provider/support",
  },
  { icon: Settings, label: "Hồ sơ dịch vụ", path: "/provider/profile" },
];

export const adminNavItems: DashboardNavItem[] = [
  { icon: LayoutDashboard, label: "Tổng quan", path: "/admin" },
  { icon: Users, label: "Người dùng", path: "/admin/users" },
  {
    icon: ShieldCheck,
    label: "Hồ sơ xét duyệt",
    path: "/admin/provider-applications",
  },
  { icon: Star, label: "Đánh giá", path: "/admin/feedbacks" },
  { icon: Grid2X2, label: "Danh mục dịch vụ", path: "/admin/categories" },
  { icon: HardHat, label: "Dịch vụ", path: "/admin/services" },
  {
    icon: Lightbulb,
    label: "Đề xuất dịch vụ",
    path: "/admin/service-suggestions",
  },
  { icon: Tag, label: "Khuyến mãi", path: "/admin/promotions" },
  {
    icon: Wallet,
    label: "Rút tiền",
    path: "/admin/withdrawals",
  },
  { icon: LifeBuoy, label: "Yêu cầu hỗ trợ", path: "/admin/support" },
  { icon: Gavel, label: "Khiếu nại & vi phạm", path: "/admin/cases" },
  { icon: ReceiptText, label: "Thanh toán", path: "/admin/payments" },
  { icon: Wallet, label: "Ví provider", path: "/admin/wallets" },
  { icon: Bell, label: "Thông báo", path: "/admin/notifications" },
  { icon: Newspaper, label: "Tin tức", path: "/admin/news" },
  { icon: Banknote, label: "Doanh thu hệ thống", path: "/admin/revenue" },
  {
    icon: Settings,
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
