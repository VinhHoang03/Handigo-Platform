import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Navbar, type AppRole } from "./common/Navbar";
import { NotificationBell } from "./common/NotificationBell";
import { useAuthStore } from "../features/auth/store/auth.store";
import { isNavItemActive } from "@/config/sidebarNavigation";
import { authService } from "@/features/auth/services/auth.service";

interface NavItem {
  icon: string;
  label: string;
  path: string;
  matchPrefix?: boolean;
}

interface SidebarProps {
  navItems: NavItem[];
  role?: AppRole;
  isProvider?: boolean;
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
  isProvider = false,
  switchLabel,
  onSwitch,
  switchVariant = "outline",
}: SidebarProps) {
  const location = useLocation();
  const homePath = role ? sidebarHomePath[role] : "/";
  const subtitle = role ? sidebarSubtitle[role] : "Dịch vụ tại nhà";

  return (
    <aside
      className={`fixed bottom-6 left-4 z-40 hidden w-72 flex-col gap-5 rounded-2xl border border-outline-variant/30 bg-white/92 p-5 shadow-[0_14px_40px_rgba(19,27,46,0.08)] backdrop-blur-xl lg:flex xl:left-6 ${isProvider ? "top-6" : "top-28"
        }`}
    >
      <Link
        to={homePath}
        className="mb-1 flex items-center gap-3 rounded-xl px-1 py-2"
      >
        {/* <img src={logoImg} alt="" className="h-9 w-9 object-contain" /> */}
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
          const active = isNavItemActive(location.pathname, item);
          return (
            <Link
              key={item.label}
              to={item.path}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 transition-all ${active
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

interface ProviderTopbarProps {
  userAvatar?: string;
  isOnline?: boolean;
  onStatusToggle?: () => void;
  switchLabel?: string;
  onSwitch?: () => void;
}

function ProviderTopbar({
  userAvatar,
  isOnline = false,
  onStatusToggle,
  switchLabel,
  onSwitch,
}: ProviderTopbarProps) {
  const user = useAuthStore((state) => state.user);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const avatar =
    userAvatar ||
    user?.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || "Handigo")}&background=4f46e5&color=fff`;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        accountRef.current &&
        !accountRef.current.contains(event.target as Node)
      ) {
        setIsAccountOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsAccountOpen(false);
    await authService.logout();
    navigate("/", { replace: true });
  };

  return (
    <header className="fixed left-4 right-4 top-6 z-30 rounded-2xl border border-outline-variant/30 bg-white/92 px-4 py-3 shadow-[0_14px_40px_rgba(19,27,46,0.08)] backdrop-blur-xl lg:left-80 xl:left-[21rem]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-on-surface-variant transition-colors hover:text-primary"
          >
            <span className="material-symbols-outlined !text-[20px]">home</span>
            <span className="text-[13px] font-medium text-on-surface">
              Trang chủ
            </span>
          </Link>
          <span className="material-symbols-outlined pointer-events-none select-none !text-sm text-outline-variant">
            chevron_right
          </span>
          <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-primary/80">
            Kênh của tôi
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-3 rounded-full bg-surface-container px-3 py-1.5 sm:flex">
            <span
              className={`text-xs font-semibold ${isOnline ? "text-primary" : "text-on-surface-variant"
                }`}
            >
              {isOnline ? "Trực tuyến" : "Ngoại tuyến"}
            </span>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={isOnline}
                onChange={onStatusToggle}
                className="peer sr-only"
              />
              <span className="h-6 w-11 rounded-full bg-outline-variant after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-outline-variant after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full" />
            </label>
          </div>

          {switchLabel && onSwitch && (
            <button
              type="button"
              onClick={onSwitch}
              className="hidden rounded-lg border border-primary/20 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10 md:inline-flex"
            >
              {switchLabel}
            </button>
          )}

          <NotificationBell role="PROVIDER" />
          <button
            type="button"
            aria-label="Tin nhắn"
            className="material-symbols-outlined hidden rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary sm:inline-flex"
          >
            chat_bubble
          </button>
          <div ref={accountRef} className="relative">
            <button
              type="button"
              aria-label="Tài khoản"
              aria-expanded={isAccountOpen}
              onClick={() => setIsAccountOpen((open) => !open)}
              className="h-10 w-10 overflow-hidden rounded-full border border-outline-variant bg-surface-container-highest transition-all hover:border-primary focus:ring-4 focus:ring-primary/15"
            >
              <img
                alt="Ảnh đại diện"
                src={avatar}
                className="h-full w-full object-cover"
              />
            </button>

            {isAccountOpen && (
              <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-outline-variant/40 bg-white shadow-[0_18px_45px_rgba(19,27,46,0.16)]">
                <div className="border-b border-outline-variant/30 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-on-surface">
                    {user?.fullName || "Nhà cung cấp"}
                  </p>
                  <p className="truncate text-xs text-on-surface-variant">
                    {user?.email || "Kênh của provider"}
                  </p>
                </div>

                <div className="py-2">
                  <Link
                    to="/provider/profile"
                    onClick={() => setIsAccountOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-low hover:text-primary"
                  >
                    <span className="material-symbols-outlined !text-[20px]">
                      person
                    </span>
                    Hồ sơ cá nhân
                  </Link>
                  <Link
                    to="/provider/wallet"
                    onClick={() => setIsAccountOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-low hover:text-primary"
                  >
                    <span className="material-symbols-outlined !text-[20px]">
                      account_balance_wallet
                    </span>
                    Ví
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-error transition hover:bg-error/10"
                  >
                    <span className="material-symbols-outlined !text-[20px]">
                      logout
                    </span>
                    Đăng xuất
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
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
  const location = useLocation();
  const currentRole = role ?? normalizeRole(user?.role);
  const isAdmin = currentRole === "ADMIN";
  const isProvider = currentRole === "PROVIDER";
  const hasSidebar = Boolean(currentRole && navItems.length);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background font-body-md text-body-md">
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

      {hasSidebar && (
        <Sidebar
          navItems={navItems}
          role={currentRole}
          isProvider={isProvider}
          switchLabel={switchLabel}
          onSwitch={onSwitch}
          switchVariant={switchVariant}
        />
      )}

      <main
        className={`relative min-h-screen pb-12 pt-32 ${hasSidebar ? "lg:pl-80 xl:pl-[21rem]" : ""}`}
      >
        <div
          className={`mx-auto space-y-8 px-4 sm:px-5 ${isAdmin || isProvider
              ? "max-w-6xl lg:px-3 xl:px-4"
              : "max-w-container-max lg:px-8"
            }`}
        >
          {children}
        </div>

        {hasSidebar && (
          <nav className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-4 border-t border-outline-variant/30 bg-white/92 px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden">
            {navItems.slice(0, 4).map((item) => {
              const active = isNavItemActive(location.pathname, item);
              const className = `flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-center ${active ? "bg-primary/10 text-primary" : "text-on-surface-variant"
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
        )}
      </main>
    </div>
  );
}
