import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { authService } from "@/features/auth/services/auth.service";
import { useAuthStore } from "@/features/auth/store/auth.store";
import type { User } from "@/features/auth/types/auth.types";
import { BrandLogo } from "./BrandLogo";

export type AppRole = "CUSTOMER" | "PROVIDER" | "ADMIN";

interface NavbarItem {
  label: string;
  path: string;
  activePrefix?: string;
}

interface NavbarProps {
  role?: AppRole;
  isScrolled?: boolean;
  userAvatar?: string;
  showStatusToggle?: boolean;
  isOnline?: boolean;
  onStatusToggle?: () => void;
}

const normalizeRole = (
  role?: User["role"] | string | null,
): AppRole | undefined => {
  const value = role?.toUpperCase();
  if (value === "CUSTOMER" || value === "PROVIDER" || value === "ADMIN") {
    return value;
  }
  return undefined;
};

const getProfilePath = (role?: AppRole) => {
  if (role === "PROVIDER") return "/provider/profile";
  if (role === "CUSTOMER") return "/customer/profile";
  return "/admin/users";
};

const getWalletPath = (role?: AppRole) => {
  if (role === "PROVIDER") return "/provider/wallet";
  if (role === "CUSTOMER") return "/customer/wallet";
  return "#";
};

const getRoleLabel = (role?: AppRole) => {
  if (role === "CUSTOMER") return "Khách hàng";
  if (role === "PROVIDER") return "Nhà cung cấp";
  if (role === "ADMIN") return "Quản trị viên";
  return "Khách";
};

const createNavbarItems = (role?: AppRole): NavbarItem[] => {
  const items: NavbarItem[] = [
    { label: "Trang chủ", path: "/" },
    { label: "Dịch vụ", path: "#" },
    { label: "Giới thiệu", path: "#" },
    { label: "Tin tức", path: "#" },
    { label: "Hỗ trợ", path: "#" },
  ];

  if (role === "PROVIDER") {
    return [
      ...items,
      { label: "Đơn của tôi", path: "#" },
      { label: "Lịch", path: "#" },
    ];
  }

  if (role === "ADMIN") {
    return [
      ...items,
      {
        label: "Quản lý hệ thống",
        path: "/admin/users",
        activePrefix: "/admin",
      },
    ];
  }

  return items;
};

export function Navbar({
  role,
  isScrolled,
  userAvatar,
  showStatusToggle = false,
  isOnline = false,
  onStatusToggle,
}: NavbarProps) {
  const [internalScrolled, setInternalScrolled] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const currentRole = role ?? normalizeRole(user?.role);
  const scrolled = isScrolled ?? internalScrolled;
  const navItems = useMemo(() => createNavbarItems(currentRole), [currentRole]);
  const avatar =
    userAvatar ||
    user?.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || "Handigo")}&background=4f46e5&color=fff`;

  useEffect(() => {
    const handleScroll = () => setInternalScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
    await authService.logout();
    navigate("/", { replace: true });
  };

  const isActive = (item: NavbarItem) => {
    if (item.path === "#") return false;
    if (item.activePrefix)
      return location.pathname.startsWith(item.activePrefix);
    return location.pathname === item.path;
  };

  return (
    <nav
      className={`fixed left-1/2 z-[70] w-[calc(100%-32px)] max-w-7xl -translate-x-1/2 rounded-2xl border border-outline-variant/40 bg-white/85 px-4 py-3 text-primary shadow-sm backdrop-blur-xl transition-all duration-300 sm:px-6 ${
        scrolled ? "top-2 shadow-xl" : "top-4"
      }`}
    >
      <div className="relative flex items-center justify-between gap-3">
        <BrandLogo compact to="/" />

        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-2 xl:flex">
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.label}
                to={item.path}
                className={`rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-primary text-on-primary shadow-[0_8px_18px_rgba(53,37,205,0.18)]"
                    : "text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {isAuthenticated && user ? (
            <>
              {showStatusToggle && (
                <div className="hidden items-center gap-3 rounded-full bg-surface-container px-3 py-1.5 lg:flex">
                  <span
                    className={`text-xs font-semibold ${isOnline ? "text-primary" : "text-on-surface-variant"}`}
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
              )}

              <button
                type="button"
                aria-label="Thông báo"
                className="material-symbols-outlined hidden rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary sm:inline-flex"
              >
                notifications
              </button>
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
                  aria-label="Mở menu tài khoản"
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
                  <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-outline-variant/30 bg-white py-2 shadow-[0_14px_40px_rgba(19,27,46,0.14)]">
                    <div className="border-b border-outline-variant/20 px-4 py-3">
                      <p className="truncate font-semibold text-on-surface">
                        {user.fullName || "Người dùng"}
                      </p>
                      <p className="truncate text-sm text-on-surface-variant">
                        {user.email || "N/A"}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-primary">
                        {getRoleLabel(currentRole)}
                      </p>
                    </div>
                    <div className="py-2">
                      <Link
                        to={getProfilePath(currentRole)}
                        onClick={() => setIsAccountOpen(false)}
                        className="flex w-full items-center gap-3 px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-low"
                      >
                        <span className="material-symbols-outlined text-xl">
                          {currentRole === "ADMIN"
                            ? "admin_panel_settings"
                            : "person"}
                        </span>
                        {currentRole === "ADMIN"
                          ? "Quản lý hệ thống"
                          : "Hồ sơ cá nhân"}
                      </Link>
                      {(currentRole === "CUSTOMER" ||
                        currentRole === "PROVIDER") && (
                        <Link
                          to={getWalletPath(currentRole)}
                          onClick={() => setIsAccountOpen(false)}
                          className="flex w-full items-center gap-3 px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-low"
                        >
                          <span className="material-symbols-outlined text-xl">
                            account_balance_wallet
                          </span>
                          Ví
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="mt-1 flex w-full items-center gap-3 px-4 py-2 text-sm text-error hover:bg-error/10"
                      >
                        <span className="material-symbols-outlined text-xl">
                          logout
                        </span>
                        Đăng xuất
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden rounded-lg px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low sm:inline-flex"
              >
                Đăng nhập
              </Link>
              <Link
                to="/register"
                className="btn-primary min-h-10 px-4 py-2 text-sm sm:px-5"
              >
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </div>

      {isMobileOpen && (
        <div className="mt-3 border-t border-outline-variant/20 pt-3 xl:hidden">
          {showStatusToggle && isAuthenticated && (
            <div className="mb-2 flex items-center justify-between rounded-xl bg-surface-container px-3 py-2 lg:hidden">
              <span
                className={`text-sm font-semibold ${isOnline ? "text-primary" : "text-on-surface-variant"}`}
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
          )}

          <div className="grid gap-1 sm:grid-cols-2">
            {navItems.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  onClick={() => setIsMobileOpen(false)}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-primary text-on-primary"
                      : "text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
