import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { DashboardLayout } from "@/components/common/dashboard/DashboardLayout";
import {
  getNavItemsForRole,
  roleSwitchConfig,
} from "@/components/common/dashboard/dashboardNavigation";
import type { DashboardRole } from "@/components/common/dashboard/dashboard.types";

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
  const defaultSwitchLabel =
    role === "PROVIDER" ? undefined : switchConfig.label;
  const defaultOnSwitch =
    role === "PROVIDER" ? undefined : () => navigate(switchConfig.path);
  const defaultSwitchVariant =
    role === "PROVIDER" ? undefined : switchConfig.variant;
  const avatar =
    userAvatar ||
    user?.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || "Handigo")}&background=4f46e5&color=fff`;

  return (
    <DashboardLayout
      role={role}
      navItems={getNavItemsForRole(role)}
      switchLabel={switchLabel ?? defaultSwitchLabel}
      onSwitch={onSwitch ?? defaultOnSwitch}
      switchVariant={switchVariant ?? defaultSwitchVariant}
      userAvatar={avatar}
      showStatusToggle={showStatusToggle}
      isOnline={isOnline}
      onStatusToggle={onStatusToggle}
      hideSidebar={hideSidebar}
    >
      {children}
    </DashboardLayout>
  );
}
