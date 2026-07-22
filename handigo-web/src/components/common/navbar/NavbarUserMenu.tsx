import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { InitialsAvatar } from "@/components/common/InitialsAvatar";
import { MessageCenter } from "@/features/chat/components/MessageCenter";
import type { User } from "@/features/auth/types/auth.types";
import { NotificationBell } from "../NotificationBell";
import { NavbarAccountDropdown } from "./NavbarAccountDropdown";
import type { AppRole } from "./navbar.types";

interface NavbarUserMenuProps {
  isAuthenticated: boolean;
  currentRole?: AppRole;
  user: User | null;
  avatar?: string | null;
  showStatusToggle?: boolean;
  isOnline?: boolean;
  onStatusToggle?: () => void;
  onBookService: () => void;
  onRequestLogout: () => void;
}

/** Cụm nút bên phải: đặt dịch vụ, trạng thái trực tuyến, thông báo, tin nhắn, tài khoản. */
export function NavbarUserMenu({
  isAuthenticated,
  currentRole,
  user,
  avatar,
  showStatusToggle = false,
  isOnline = false,
  onStatusToggle,
  onBookService,
  onRequestLogout,
}: NavbarUserMenuProps) {
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

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

  const requestLogout = () => {
    setIsAccountOpen(false);
    onRequestLogout();
  };

  return (
    <div className="flex items-center gap-2">
      {isAuthenticated && currentRole === "CUSTOMER" && (
        <button
          type="button"
          onClick={onBookService}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-[0_8px_18px_rgba(53,37,205,0.18)] transition hover:bg-primary/90"
        >
          <span className="material-symbols-outlined text-lg">
            cleaning_services
          </span>
          Đặt dịch vụ
        </button>
      )}

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
                <span className="h-6 w-11 rounded-full bg-outline-variant after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-outline-variant after:bg-surface-container-lowest after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full" />
              </label>
            </div>
          )}

          <NotificationBell role={currentRole} />
          {(currentRole === "CUSTOMER" || currentRole === "PROVIDER") && (
            <MessageCenter />
          )}

          <div ref={accountRef} className="relative">
            <button
              type="button"
              aria-label="Mở menu tài khoản"
              aria-expanded={isAccountOpen}
              onClick={() => setIsAccountOpen((open) => !open)}
              className="h-10 w-10 overflow-hidden rounded-full border border-outline-variant bg-surface-container-highest transition-all hover:border-primary focus:ring-4 focus:ring-primary/15"
            >
              <InitialsAvatar
                name={user?.fullName || "Handigo"}
                src={avatar}
                className="h-full w-full"
                textClassName="text-xs"
              />
            </button>

            {isAccountOpen && (
              <NavbarAccountDropdown
                user={user}
                currentRole={currentRole}
                onNavigate={() => setIsAccountOpen(false)}
                onLogout={requestLogout}
              />
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
  );
}
