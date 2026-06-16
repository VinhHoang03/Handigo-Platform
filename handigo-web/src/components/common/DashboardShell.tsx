import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuthStore } from "@/features/auth/store/auth.store";

export function DashboardShell({
  role,
  children,
}: {
  role: "CUSTOMER" | "PROVIDER" | "ADMIN";
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const avatar =
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
    { icon: "category", label: "Danh mục & Dịch vụ", path: "#" },
    { icon: "local_offer", label: "Khuyến mãi", path: "#" },
    { icon: "support_agent", label: "Yêu cầu hỗ trợ", path: "#" },
    { icon: "notifications", label: "Thông báo", path: "#" },
    { icon: "payments", label: "Doanh thu hệ thống", path: "#" },
    { icon: "settings", label: "Cấu hình hệ thống", path: "#" },
  ];

  return (
    <DashboardLayout
      role={role}
      navItems={role === "ADMIN" ? adminNavItems : []}
      onSwitch={role === "ADMIN" ? () => navigate("/") : undefined}
      userAvatar={avatar}
    >
      {children}
    </DashboardLayout>
  );
}
