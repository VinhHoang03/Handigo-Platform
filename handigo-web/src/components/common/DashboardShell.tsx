import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { DashboardLayout } from "@/components/common/dashboard/DashboardLayout";
import {
  getNavItemsForRole,
  roleSwitchConfig,
} from "@/components/common/dashboard/dashboardNavigation";
import type { DashboardRole } from "@/components/common/dashboard/dashboard.types";
import { useProviderAvailability } from "@/features/provider/hooks/useProviderAvailability";

interface DashboardShellProps {
  role: DashboardRole;
  children: ReactNode;
  switchLabel?: string;
  onSwitch?: () => void;
  switchVariant?: "outline" | "gradient";
  userAvatar?: string | null;
  hideSidebar?: boolean;
}

export function DashboardShell({
  role,
  children,
  switchLabel,
  onSwitch,
  switchVariant,
  userAvatar,
  hideSidebar,
}: DashboardShellProps) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const canManageProviderAvailability =
    role === "PROVIDER" &&
    (!user?.providerOnboardingStatus ||
      user.providerOnboardingStatus === "APPROVED");
  const { isOnline, toggleAvailability } = useProviderAvailability(
    canManageProviderAvailability,
  );
  const switchConfig = roleSwitchConfig[role];
  const defaultSwitchLabel =
    role === "PROVIDER" ? undefined : switchConfig.label;
  const defaultOnSwitch =
    role === "PROVIDER" ? undefined : () => navigate(switchConfig.path);
  const defaultSwitchVariant =
    role === "PROVIDER" ? undefined : switchConfig.variant;
  // Thiếu ảnh thì để `InitialsAvatar` trong DashboardLayout tự lùi về chữ cái đầu,
  // không gọi CDN ngoài nữa.
  const avatar = userAvatar || user?.avatar;

  return (
    <DashboardLayout
      role={role}
      navItems={getNavItemsForRole(role)}
      switchLabel={switchLabel ?? defaultSwitchLabel}
      onSwitch={onSwitch ?? defaultOnSwitch}
      switchVariant={switchVariant ?? defaultSwitchVariant}
      userAvatar={avatar}
      showStatusToggle={canManageProviderAvailability}
      isOnline={isOnline}
      onStatusToggle={toggleAvailability}
      hideSidebar={hideSidebar}
    >
      {children}
    </DashboardLayout>
  );
}
