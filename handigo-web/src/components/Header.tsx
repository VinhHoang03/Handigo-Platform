import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logoImg from '../assets/logo.png';
import { authService } from '../features/auth/services/auth.service';
import { useAuthStore } from '../features/auth/store/auth.store';

export interface HeaderProps {
  userAvatar?: string;
  showStatusToggle?: boolean;
  isOnline?: boolean;
  onStatusToggle?: () => void;
}

export function Header({
  userAvatar: propAvatar,
  showStatusToggle,
  isOnline,
  onStatusToggle,
}: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const normalizedRole = user?.role?.toUpperCase();

  // Use avatar from store if available, otherwise use prop, otherwise a fallback placeholder
  const effectiveAvatar = user?.avatar || propAvatar || 'https://via.placeholder.com/150';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await authService.logout();
    navigate('/', { replace: true });
  };

  return (
    <header className="sticky top-3 z-50 mx-3 flex items-center justify-between rounded-2xl border border-outline-variant/40 bg-white/85 px-4 py-3 shadow-[0_8px_30_px_rgba(19,27,46,0.08)] backdrop-blur-xl sm:mx-5 sm:px-6 lg:mx-6">
      <div className="flex min-w-0 flex-grow items-center gap-4">
        <Link to="/" className="flex items-center gap-2 lg:hidden">
          <img src={logoImg} alt="" className="h-8 w-8 object-contain" />
          <span className="hidden font-headline-md text-xl font-bold text-primary sm:inline">
            Handigo
          </span>
        </Link>
        <div className="relative hidden w-full max-w-md sm:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
            search
          </span>
          <input
            type="search"
            aria-label="Tìm kiếm"
            placeholder="Tìm kiếm..."
            className="min-h-11 w-full rounded-full border border-transparent bg-surface-container-low py-2 pl-10 pr-4 text-sm outline-none transition-all hover:border-outline-variant focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3">
        {showStatusToggle && (
          <div className="hidden items-center gap-3 rounded-full bg-surface-container px-3 py-1.5 sm:flex">
            <span className={`text-xs font-semibold ${isOnline ? 'text-primary' : 'text-on-surface-variant'}`}>
              {isOnline ? 'Trực tuyến' : 'Ngoại tuyến'}
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
        <button type="button" aria-label="Thông báo" className="material-symbols-outlined rounded-full p-2 text-on-surface-variant hover:bg-surface-container-low hover:text-primary">
          notifications
        </button>
        <button type="button" aria-label="Tin nhắn" className="material-symbols-outlined rounded-full p-2 text-on-surface-variant hover:bg-surface-container-low hover:text-primary">
          chat_bubble
        </button>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-label="Mở menu tài khoản"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((open) => !open)}
            className="h-10 w-10 overflow-hidden rounded-full border border-outline-variant bg-surface-container-highest transition-all hover:border-primary focus:ring-4 focus:ring-primary/15"
          >
            <img alt="Ảnh đại diện" src={effectiveAvatar} className="h-full w-full object-cover" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-outline-variant/30 bg-white py-2 shadow-[0_14px_40px_rgba(19,27,46,0.14)]">
              <div className="border-b border-outline-variant/20 px-4 py-3">
                <p className="truncate font-semibold text-on-surface">{user?.fullName || 'Người dùng'}</p>
                <p className="truncate text-sm text-on-surface-variant">{user?.email || 'N/A'}</p>
                <p className="mt-1 text-xs font-semibold text-primary">
                  {normalizedRole === 'CUSTOMER'
                    ? 'Khách hàng'
                    : normalizedRole === 'PROVIDER'
                      ? 'Nhà cung cấp'
                      : 'Quản trị viên'}
                </p>
              </div>
              <div className="py-2">
                {normalizedRole !== 'ADMIN' && (
                  <Link
                    to={normalizedRole === 'PROVIDER' ? '/provider/profile' : '/customer/profile'}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-low"
                  >
                    <span className="material-symbols-outlined text-xl">person</span>
                    Hồ sơ cá nhân
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-1 flex w-full items-center gap-3 px-4 py-2 text-sm text-error hover:bg-error/10"
                >
                  <span className="material-symbols-outlined text-xl">logout</span>
                  Đăng xuất
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
