import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Navbar } from "@/components/common/Navbar";
import { AnimatedBackground } from "@/components/home/AnimatedBackground";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { DashboardSidebar } from "./DashboardSidebar";
import { ProviderTopbar } from "./ProviderTopbar";
import { isNavItemActive, getDashboardNavLabel } from "./dashboardNavigation";
import { NavPendingBadge } from "./NavPendingBadge";
import { useAdminPendingCounts } from "@/features/admin/hooks/useAdminPendingCounts";
import { withAdminPendingCounts } from "@/features/admin/utils/adminPendingNavigation";
import type { DashboardNavItem, DashboardRole } from "./dashboard.types";
import "./provider-content.css";
import "./admin-content.css";

const normalizeRole = (role?: string | null): DashboardRole | undefined => {
  const value = role?.toUpperCase();
  if (value === "CUSTOMER" || value === "PROVIDER" || value === "ADMIN") {
    return value;
  }
  return undefined;
};

interface DashboardLayoutProps {
  children: ReactNode;
  role?: DashboardRole;
  navItems?: DashboardNavItem[];
  switchLabel?: string;
  onSwitch?: () => void;
  switchVariant?: "outline" | "gradient";
  userAvatar?: string | null;
  showStatusToggle?: boolean;
  isOnline?: boolean;
  onStatusToggle?: () => void;
  hideSidebar?: boolean;
}

export function DashboardLayout({
  children,
  role,
  navItems = [],
  switchLabel,
  onSwitch,
  switchVariant,
  userAvatar,
  showStatusToggle,
  isOnline,
  onStatusToggle,
  hideSidebar = false,
}: DashboardLayoutProps) {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const currentRole = role ?? normalizeRole(user?.role);
  const isAdmin = currentRole === "ADMIN";
  const isProvider = currentRole === "PROVIDER";
  const hasSidebar = Boolean(
    currentRole &&
    currentRole !== "CUSTOMER" &&
    !hideSidebar &&
    navItems.length > 0,
  );
  const { counts, stale } = useAdminPendingCounts(isAdmin && hasSidebar);
  const navigationItems = isAdmin ? withAdminPendingCounts(navItems, counts, stale) : navItems;

  return (
    <div className={`min-h-dvh ${isAdmin ? "overflow-x-clip" : "overflow-x-hidden"} bg-background font-body-md text-body-md ${isProvider ? "relative isolate" : ""}`}>
      {isProvider && <AnimatedBackground />}
      {isProvider ? (
        <ProviderTopbar
          userAvatar={userAvatar}
          isOnline={isOnline}
          onStatusToggle={onStatusToggle}
          switchLabel={switchLabel}
          onSwitch={onSwitch}
        />
      ) : (
        <Navbar
          adminSidebar={isAdmin && hasSidebar ? (isSidebarCollapsed ? "collapsed" : "expanded") : undefined}
          role={currentRole}
          userAvatar={userAvatar}
          showStatusToggle={showStatusToggle}
          isOnline={isOnline}
          onStatusToggle={onStatusToggle}
        />
      )}

      {hasSidebar && currentRole && (
        <DashboardSidebar
          role={currentRole}
          navItems={navigationItems}
          switchLabel={switchLabel}
          onSwitch={onSwitch}
          switchVariant={switchVariant}
          collapsed={isAdmin && isSidebarCollapsed}
          onToggle={isAdmin ? () => setIsSidebarCollapsed((value) => !value) : undefined}
        />
      )}

      <main
        id="main-content"
        className={`relative min-h-dvh pb-12 ${isAdmin ? "pt-28 lg:pt-[88px]" : "pt-32"} transition-[padding-left] duration-300 motion-reduce:transition-none ${hasSidebar ? (isAdmin ? (isSidebarCollapsed ? "lg:pl-20" : "lg:pl-72") : "lg:pl-24 xl:pl-28") : ""}`}
      >
        <div
          className={`mx-auto px-4 sm:px-5 ${isProvider ? "provider-content space-y-5" : isAdmin ? "admin-content space-y-4" : "space-y-8"} ${
            isAdmin
              ? "max-w-none lg:px-5 xl:px-6"
              : isProvider
                ? "max-w-[1600px] lg:px-6 xl:px-8"
                : "max-w-container-max lg:px-8"
          }`}
        >
          {children}
        </div>

        {hasSidebar && (
          <nav className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-4 border-t border-outline-variant/30 bg-surface-container-lowest/92 px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden">
            {navigationItems.slice(0, 4).map((item) => {
              const active = isNavItemActive(location.pathname, item);
              const className = `flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-center ${active ? "bg-primary/10 text-primary" : "text-on-surface-variant"}`;

              if (item.path === "#") {
                return (
                  <span
                    key={item.label}
                    className={`${className} cursor-not-allowed opacity-50`}
                    aria-disabled="true"
                  >
                    <item.icon aria-hidden="true" size={20} />
                    <span className="max-w-full truncate text-[10px] font-medium">
                      {item.label}
                    </span>
                  </span>
                );
              }

              return (
                <Link key={item.label} to={item.path} className={className} aria-label={getDashboardNavLabel(item)}>
                  <span className="relative inline-flex shrink-0"><item.icon aria-hidden="true" size={20} />
                    <NavPendingBadge count={item.pendingCount} compact stale={item.pendingStale} />
                  </span>
                  <span className="max-w-full truncate text-[10px] font-medium">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        )}
      </main>
    </div>
  );
}
