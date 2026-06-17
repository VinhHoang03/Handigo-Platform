import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import logoImg from "../assets/logo.png";
import { Navbar, type AppRole } from "./common/Navbar";
import { useAuthStore } from "../features/auth/store/auth.store";
import { isNavItemActive } from "@/config/sidebarNavigation";

interface NavItem {
  icon: string;
  label: string;
  path: string;
}

interface SidebarProps {
  navItems: NavItem[];
  role?: AppRole;
  switchLabel?: string;
  onSwitch?: () => void;
  switchVariant?: "outline" | "gradient";
}

const sidebarHomePath: Record<AppRole, string> = {
  CUSTOMER: "/customer",
  PROVIDER: "/provider",
  ADMIN: "/admin/users",
};

const sidebarSubtitle: Record<AppRole, string> = {
  CUSTOMER: "Dịch vụ tại nhà",
  PROVIDER: "Nhà cung cấp",
  ADMIN: "Quản trị hệ thống",
};

const normalizeRole = (role?: string | null): AppRole | undefined => {
  const value = role?.toUpperCase();
  if (value === "CUSTOMER" || value === "PROVIDER" || value === "ADMIN") {
    return value;
  }
  return undefined;
};

export function Sidebar({
  navItems,
  role,
  switchLabel,
  onSwitch,
  switchVariant = "outline",
}: SidebarProps) {
  const location = useLocation();
  const homePath = role ? sidebarHomePath[role] : "/";
  const subtitle = role ? sidebarSubtitle[role] : "Dịch vụ tại nhà";

  return (
    <aside className="fixed bottom-6 left-4 top-28 z-40 hidden w-72 flex-col gap-5 rounded-2xl border border-outline-variant/30 bg-white/92 p-5 shadow-[0_14px_40px_rgba(19,27,46,0.08)] backdrop-blur-xl lg:flex xl:left-6">
      <Link
        to={homePath}
        className="mb-1 flex items-center gap-3 rounded-xl px-1 py-2"
      >
        <img src={logoImg} alt="" className="h-9 w-9 object-contain" />
        <div>
          <h1 className="font-headline-md text-xl font-bold leading-none text-primary">
            Handigo
          </h1>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-on-surface-variant">
            {subtitle}
          </p>
        </div>
      </Link>

      <nav className="flex min-h-0 flex-grow flex-col gap-1.5 overflow-y-auto pr-1">
        {navItems.map((item) => {
          const active =
            item.path !== "#" &&
            (location.pathname === item.path ||
              location.pathname.startsWith(`${item.path}/`));
          return (
            <Link
              key={item.label}
              to={item.path}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 transition-all ${
                active
                  ? "bg-primary font-semibold text-on-primary shadow-[0_8px_18px_rgba(53,37,205,0.18)]"
                  : "text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
              }`}
            >
              <span className="material-symbols-outlined shrink-0">
                {item.icon}
              </span>
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {switchLabel && onSwitch && (
        <button
          type="button"
          onClick={onSwitch}
          className={
            switchVariant === "gradient"
              ? "btn-primary mt-auto w-full bg-gradient-to-r from-primary to-secondary"
              : "btn-secondary mt-auto w-full"
          }
        >
          {switchVariant === "gradient" && (
            <span className="material-symbols-outlined text-base">
              engineering
            </span>
          )}
          {switchLabel}
        </button>
      )}
    </aside>
  );
}

interface DashboardLayoutProps {
  children: ReactNode;
  role?: AppRole;
  navItems?: NavItem[];
  switchLabel?: string;
  onSwitch?: () => void;
  switchVariant?: "outline" | "gradient";
  userAvatar?: string;
  showStatusToggle?: boolean;
  isOnline?: boolean;
  onStatusToggle?: () => void;
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
}: DashboardLayoutProps) {
  const user = useAuthStore((state) => state.user);
  const currentRole = role ?? normalizeRole(user?.role);
  const isAdmin = currentRole === "ADMIN";
  const hasSidebar = Boolean(currentRole && navItems.length);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background font-body-md text-body-md">
      <Navbar
        role={currentRole}
        userAvatar={userAvatar}
        showStatusToggle={showStatusToggle}
        isOnline={isOnline}
        onStatusToggle={onStatusToggle}
      />

      {hasSidebar && (
        <Sidebar
          navItems={navItems}
          role={currentRole}
          switchLabel={switchLabel}
          onSwitch={onSwitch}
          switchVariant={switchVariant}
        />
      )}

      <main
        className={`relative min-h-screen pb-12 pt-32 ${hasSidebar ? "lg:pl-80 xl:pl-[21rem]" : ""}`}
      >
        <div
          className={`mx-auto space-y-8 px-4 sm:px-5 ${
            isAdmin
              ? "max-w-6xl lg:px-3 xl:px-4"
              : "max-w-container-max lg:px-8"
          }`}
        >
          {children}
        </div>

        <nav className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-4 border-t border-outline-variant/30 bg-white/92 px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden">
          {navItems.slice(0, 4).map((item) => {
            const active = isNavItemActive(location.pathname, item);
            const className = `flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-center ${
              active ? "bg-primary/10 text-primary" : "text-on-surface-variant"
            }`;

            if (item.path === "#") {
              return (
                <span
                  key={item.label}
                  className={`${className} cursor-not-allowed opacity-50`}
                  aria-disabled="true"
                >
                  <span className="material-symbols-outlined text-xl">
                    {item.icon}
                  </span>
                  <span className="max-w-full truncate text-[10px] font-medium">
                    {item.label}
                  </span>
                </span>
              );
            }

            return (
              <Link key={item.label} to={item.path} className={className}>
                <span className="material-symbols-outlined text-xl">
                  {item.icon}
                </span>
                <span className="max-w-full truncate text-[10px] font-medium">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
