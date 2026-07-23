import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Navbar } from "@/components/common/Navbar";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { DashboardSidebar } from "./DashboardSidebar";
import { ProviderTopbar } from "./ProviderTopbar";
import { isNavItemActive } from "./dashboardNavigation";
import type { DashboardNavItem, DashboardRole } from "./dashboard.types";

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
  const currentRole = role ?? normalizeRole(user?.role);
  const isAdmin = currentRole === "ADMIN";
  const isProvider = currentRole === "PROVIDER";
  const hasSidebar = Boolean(
    currentRole &&
    currentRole !== "CUSTOMER" &&
    !hideSidebar &&
    navItems.length > 0,
  );

  return (
    <div className="min-h-dvh overflow-x-hidden bg-background font-body-md text-body-md">
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
          navItems={navItems}
          switchLabel={switchLabel}
          onSwitch={onSwitch}
          switchVariant={switchVariant}
        />
      )}

      <main
        id="main-content"
        className={`relative min-h-dvh pb-12 pt-32 ${hasSidebar ? "lg:pl-80 xl:pl-[21rem]" : ""}`}
      >
        <div
          className={`mx-auto space-y-8 px-4 sm:px-5 ${
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
            {navItems.slice(0, 4).map((item) => {
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
                <Link key={item.label} to={item.path} className={className}>
                  <item.icon aria-hidden="true" size={20} />
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
