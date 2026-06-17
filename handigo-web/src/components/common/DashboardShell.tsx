import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import {
  getNavItemsForRole,
  roleSwitchConfig,
  type DashboardRole,
} from '@/config/sidebarNavigation';

interface DashboardShellProps {
  role: DashboardRole;
  children: ReactNode;
  switchLabel?: string;
  onSwitch?: () => void;
  switchVariant?: 'outline' | 'gradient';
  userAvatar?: string;
  showStatusToggle?: boolean;
  isOnline?: boolean;
  onStatusToggle?: () => void;
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
}: DashboardShellProps) {
  const navigate = useNavigate();
  const switchConfig = roleSwitchConfig[role];

  return (
    <DashboardLayout
      navItems={getNavItemsForRole(role)}
      switchLabel={switchLabel ?? switchConfig.label}
      onSwitch={onSwitch ?? (() => navigate(switchConfig.path))}
      switchVariant={switchVariant ?? switchConfig.variant}
      userAvatar={userAvatar}
      showStatusToggle={showStatusToggle}
      isOnline={isOnline}
      onStatusToggle={onStatusToggle}
    >
      {children}
    </DashboardLayout>
  );
}
