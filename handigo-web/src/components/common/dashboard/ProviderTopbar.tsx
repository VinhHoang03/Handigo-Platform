import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { InitialsAvatar } from "@/components/common/InitialsAvatar";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { NotificationBell } from "@/components/common/NotificationBell";
import { authService } from "@/features/auth/services/auth.service";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { MessageCenter } from "@/features/chat/components/MessageCenter";
import { ChevronRight, House, LogOut, User, Wallet } from "lucide-react";

interface ProviderTopbarProps {
  userAvatar?: string | null;
  isOnline?: boolean;
  onStatusToggle?: () => void;
  switchLabel?: string;
  onSwitch?: () => void;
}

/** Thanh header riêng cho kênh nhà cung cấp (không dùng chung Navbar khách hàng). */
export function ProviderTopbar({
  userAvatar,
  isOnline = false,
  onStatusToggle,
  switchLabel,
  onSwitch,
}: ProviderTopbarProps) {
  const user = useAuthStore((state) => state.user);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const avatar = userAvatar || user?.avatar;

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
    try {
      setIsLoggingOut(true);
      await authService.logout();
      navigate("/", { replace: true });
    } finally {
      setIsLoggingOut(false);
      setIsLogoutConfirmOpen(false);
    }
  };

  const requestLogout = () => {
    setIsAccountOpen(false);
    setIsLogoutConfirmOpen(true);
  };

  return (
    <header className="fixed left-4 right-4 top-6 z-30 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest/92 px-4 py-3 shadow-[0_14px_40px_rgba(19,27,46,0.08)] backdrop-blur-xl lg:left-80 xl:left-[21rem]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-on-surface-variant transition-colors hover:text-primary"
          >
            <House aria-hidden="true" size={24} className="!text-[20px]" />
            <span className="text-[13px] font-medium text-on-surface">
              Trang chủ
            </span>
          </Link>
          <ChevronRight aria-hidden="true" size={24} className="pointer-events-none select-none !text-sm text-outline-variant" />
          <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-primary/80">
            Kênh của tôi
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-3 rounded-full bg-surface-container px-3 py-1.5 sm:flex">
            <span
              className={`text-xs font-semibold ${
                isOnline ? "text-primary" : "text-on-surface-variant"
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
              <span className="h-6 w-11 rounded-full bg-outline-variant after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-outline-variant after:bg-surface-container-lowest after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full" />
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
          <div className="hidden sm:inline-flex">
            <MessageCenter />
          </div>
          <div ref={accountRef} className="relative">
            <button
              type="button"
              aria-label="Tài khoản"
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
              <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-[0_18px_45px_rgba(19,27,46,0.16)]">
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
                    <User aria-hidden="true" size={24} className="!text-[20px]" />
                    Hồ sơ cá nhân
                  </Link>
                  <Link
                    to="/provider/wallet"
                    onClick={() => setIsAccountOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-low hover:text-primary"
                  >
                    <Wallet aria-hidden="true" size={24} className="!text-[20px]" />
                    Ví
                  </Link>
                  <button
                    type="button"
                    onClick={requestLogout}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-error transition hover:bg-error/10"
                  >
                    <LogOut aria-hidden="true" size={24} className="!text-[20px]" />
                    Đăng xuất
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={isLogoutConfirmOpen}
        title="Xác nhận đăng xuất"
        message="Bạn có chắc chắn muốn đăng xuất khỏi tài khoản hiện tại?"
        busy={isLoggingOut}
        variant="danger"
        onCancel={() => setIsLogoutConfirmOpen(false)}
        onConfirm={() => void handleLogout()}
      />
    </header>
  );
}
