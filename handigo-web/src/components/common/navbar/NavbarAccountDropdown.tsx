import { Link } from "react-router-dom";
import type { User } from "@/features/auth/types/auth.types";
import { getProfilePath, getRoleLabel, getWalletPath, type AppRole } from "./navbar.types";
import { LifeBuoy, LogOut, ReceiptText, Wallet } from "lucide-react";

interface NavbarAccountDropdownProps {
  user: User;
  currentRole?: AppRole;
  onNavigate: () => void;
  onLogout: () => void;
}

/** Nội dung menu thả xuống của avatar tài khoản trên Navbar. */
export function NavbarAccountDropdown({
  user,
  currentRole,
  onNavigate,
  onLogout,
}: NavbarAccountDropdownProps) {
  return (
    <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest py-2 shadow-[0_14px_40px_rgba(19,27,46,0.14)]">
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
          onClick={onNavigate}
          className="flex w-full items-center gap-3 px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-low"
        >
          <span className="material-symbols-outlined text-xl">
            {currentRole === "ADMIN" ? "admin_panel_settings" : "person"}
          </span>
          {currentRole === "ADMIN" ? "Quản lý hệ thống" : "Hồ sơ cá nhân"}
        </Link>
        {currentRole === "CUSTOMER" && (
          <>
            <Link
              to="/customer/bookings"
              onClick={onNavigate}
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-low"
            >
              <ReceiptText aria-hidden="true" size={20} />
              Đơn dịch vụ của tôi
            </Link>
            <Link
              to="/customer/support"
              onClick={onNavigate}
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-low"
            >
              <LifeBuoy aria-hidden="true" size={20} />
              Khiếu nại, hỗ trợ & báo cáo
            </Link>
          </>
        )}
        {(currentRole === "CUSTOMER" || currentRole === "PROVIDER") && (
          <Link
            to={getWalletPath(currentRole)}
            onClick={onNavigate}
            className="flex w-full items-center gap-3 px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-low"
          >
            <Wallet aria-hidden="true" size={20} />
            Ví
          </Link>
        )}
        <button
          type="button"
          onClick={onLogout}
          className="mt-1 flex w-full items-center gap-3 px-4 py-2 text-sm text-error hover:bg-error/10"
        >
          <LogOut aria-hidden="true" size={20} />
          Đăng xuất
        </button>
      </div>
    </div>
  );
}
