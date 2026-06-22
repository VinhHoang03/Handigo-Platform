import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  getNavItemsForRole,
  roleSwitchConfig,
  type DashboardRole,
} from "@/config/sidebarNavigation";

interface DashboardShellProps {
  role: DashboardRole;
  children: ReactNode;
  switchLabel?: string;
  onSwitch?: () => void;
  switchVariant?: "outline" | "gradient";
  userAvatar?: string;
  showStatusToggle?: boolean;
  isOnline?: boolean;
  onStatusToggle?: () => void;
  hideSidebar?: boolean;
}

export function DashboardShell({
  role,
  children,
  switchLabel,
  onSwitch,
  switchVariant,
  userAvatar,
  showStatusToggle,
  isOnline,
  onStatusToggle,
  hideSidebar,
}: DashboardShellProps) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const switchConfig = roleSwitchConfig[role];
  const avatar =
    userAvatar ||
    user?.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || "Handigo")}&background=4f46e5&color=fff`;
  const adminNavItems = [
    { icon: "people", label: "Người dùng", path: "/admin/users" },
    {
      icon: "verified_user",
      label: "Hồ sơ xét duyệt",
      path: "/admin/provider-applications",
    },
    { icon: "reviews", label: "Đánh giá", path: "/admin/feedbacks" },
    { icon: "category", label: "Danh mục dịch vụ", path: "/admin/categories" },
    { icon: "construction", label: "Dịch vụ", path: "/admin/services" },
    { icon: "lightbulb", label: "Đề xuất dịch vụ", path: "/admin/service-suggestions" },
    { icon: "local_offer", label: "Khuyến mãi", path: "/admin/promotions" },
    { icon: "account_balance_wallet", label: "Rút tiền", path: "/admin/withdrawals" },
    { icon: "support_agent", label: "Yêu cầu hỗ trợ", path: "#" },
    { icon: "notifications", label: "Thông báo", path: "/admin/notifications" },
    { icon: "payments", label: "Doanh thu hệ thống", path: "#" },
    { icon: "settings", label: "Cấu hình hệ thống", path: "/admin/system-configs" },
  ];

  return (
    <DashboardLayout
      role={role}
      navItems={
        role === "CUSTOMER"
          ? getNavItemsForRole(role)
          : role === "ADMIN"
            ? adminNavItems
            : getNavItemsForRole(role)
      }
      switchLabel={role !== "PROVIDER" ? (switchLabel ?? switchConfig.label) : undefined}
      onSwitch={role !== "PROVIDER" ? (onSwitch ?? (() => navigate(switchConfig.path))) : undefined}
      switchVariant={role !== "PROVIDER" ? (switchVariant ?? switchConfig.variant) : undefined}
      userAvatar={avatar}
      showStatusToggle={showStatusToggle}
      isOnline={isOnline}
      onStatusToggle={onStatusToggle}
      hideSidebar={role === "CUSTOMER" || hideSidebar}
    >
      {children}
    </DashboardLayout>
  );
}
