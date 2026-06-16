import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logoImg from '../assets/logo.png';
import { authService } from '../features/auth/services/auth.service';
import { useAuthStore } from '../features/auth/store/auth.store';

interface NavItem {
  icon: string;
  label: string;
  path: string;
}

interface SidebarProps {
  navItems: NavItem[];
  switchLabel: string;
  onSwitch: () => void;
  switchVariant?: 'outline' | 'gradient';
}

export const Sidebar: React.FC<SidebarProps> = ({
  navItems,
  switchLabel,
  onSwitch,
  switchVariant = 'outline',
}) => {
  const location = useLocation();

  return (
    <aside className="hidden md:flex flex-col gap-sm p-md h-screen w-64 fixed left-0 top-0 bg-surface border-r border-outline-variant/30 z-[60] shadow-sm">
      <div className="flex items-center gap-sm mb-md px-base">
        <img src={logoImg} alt="HandiGo Logo" className="h-8 w-auto" />
        <div className="flex flex-col">
          <h1 className="font-headline-md text-headline-md font-extrabold text-primary leading-none">HandiGo</h1>
          <p className="text-[10px] font-label-md text-on-surface-variant">Dịch vụ gia đình cao cấp</p>
        </div>
      </div>

      <nav className="flex flex-col gap-xs flex-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.label}
              to={item.path}
              className={`flex items-center gap-base px-md py-sm rounded-xl transition-all duration-300 active:scale-[0.98] ${
                isActive
                  ? 'bg-primary-container text-on-primary-container font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:translate-x-1'
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="font-label-md text-label-md">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {switchVariant === 'gradient' ? (
        <button
          onClick={onSwitch}
          className="mt-auto w-full py-sm px-md bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:opacity-90 transition-all active:scale-95 shadow-sm flex items-center justify-center gap-base"
        >
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
            engineering
          </span>
          {switchLabel}
        </button>
      ) : (
        <button
          onClick={onSwitch}
          className="mt-auto w-full py-sm px-md border border-primary text-primary rounded-xl font-label-md text-label-md hover:bg-primary/5 transition-colors"
        >
          {switchLabel}
        </button>
      )}
    </aside>
  );
};

interface HeaderProps {
  userAvatar: string;
  showStatusToggle?: boolean;
  isOnline?: boolean;
  onStatusToggle?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  userAvatar,
  showStatusToggle,
  isOnline,
  onStatusToggle,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

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
    try {
      await authService.logout();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between w-full px-md py-sm bg-surface/80 backdrop-blur-md border-b border-outline-variant/30 shadow-sm">
      <div className="flex items-center gap-md flex-1 min-w-0">
        <div className="md:hidden flex items-center gap-2 shrink-0">
          <img src={logoImg} alt="HandiGo Logo" className="h-6 w-auto" />
          <span className="font-headline-md text-headline-md font-bold text-primary leading-none">HandiGo</span>
        </div>

        <div className="relative w-full max-w-md hidden md:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">
            search
          </span>
          <input
            className="w-full pl-10 pr-4 py-2 bg-surface-container rounded-full border-none focus:ring-2 focus:ring-primary/20 text-body-md transition-all outline-none"
            placeholder="Tìm dịch vụ (ví dụ: Sửa máy lạnh...)"
            type="text"
          />
        </div>
      </div>

      <div className="flex items-center gap-sm">
        {showStatusToggle ? (
          <div className="hidden sm:flex items-center gap-3 bg-surface-container px-3 py-1.5 rounded-full">
            <span className={`font-label-sm text-label-sm ${isOnline ? 'text-primary' : 'text-on-surface-variant'}`}>
              {isOnline ? 'Trực tuyến' : 'Ngoại tuyến'}
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isOnline}
                onChange={onStatusToggle}
                className="sr-only peer"
              />
              <span className="w-11 h-6 bg-outline-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
            </label>
          </div>
        ) : null}

        <button className="p-2 rounded-full hover:bg-surface-container-high/50 transition-all active:scale-95">
          <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
        </button>
        <button className="p-2 rounded-full hover:bg-surface-container-high/50 transition-all active:scale-95">
          <span className="material-symbols-outlined text-on-surface-variant">chat</span>
        </button>
        <div className="h-8 w-px bg-outline-variant/30 mx-2 hidden sm:block" />

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-xs focus:outline-none focus:ring-2 focus:ring-primary rounded-full"
          >
            <img
              alt="Ảnh đại diện người dùng"
              src={userAvatar}
              className="w-8 h-8 rounded-full border border-primary/20 object-cover"
            />
            <span className="hidden sm:block font-label-md text-on-surface font-semibold max-w-32 truncate">
              {user?.fullName || 'Minh Anh'}
            </span>
          </button>

          {isMenuOpen ? (
            <div className="absolute right-0 mt-2 w-64 bg-surface rounded-xl shadow-lg border border-outline-variant/30 py-2 z-50">
              <div className="px-4 py-3 border-b border-outline-variant/20">
                <p className="font-label-md text-on-surface font-semibold truncate">{user?.fullName || 'Người dùng'}</p>
                <p className="font-body-sm text-on-surface-variant truncate">{user?.email || 'N/A'}</p>
                <p className="font-label-sm text-primary mt-1">
                  {user?.role === 'CUSTOMER' ? 'Khách hàng' : user?.role === 'PROVIDER' ? 'Nhà cung cấp' : user?.role}
                </p>
              </div>
              <div className="py-2">
                <Link
                  to={user?.role === 'PROVIDER' ? '/provider/profile' : '/customer/profile'}
                  className="w-full px-4 py-2 flex items-center gap-3 text-on-surface-variant hover:bg-surface-container-low transition-colors font-label-md"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span className="material-symbols-outlined text-xl">person</span>
                  Hồ sơ cá nhân
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 flex items-center gap-3 text-error hover:bg-error/10 transition-colors font-label-md mt-1"
                >
                  <span className="material-symbols-outlined text-xl">logout</span>
                  Đăng xuất
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
};

interface DashboardLayoutProps {
  children: ReactNode;
  navItems: NavItem[];
  switchLabel: string;
  onSwitch: () => void;
  switchVariant?: 'outline' | 'gradient';
  userAvatar: string;
  showStatusToggle?: boolean;
  isOnline?: boolean;
  onStatusToggle?: () => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  navItems,
  switchLabel,
  onSwitch,
  switchVariant,
  userAvatar,
  showStatusToggle,
  isOnline,
  onStatusToggle,
}) => (
  <div className="font-body-md text-body-md overflow-x-hidden min-h-screen bg-background">
    <Sidebar navItems={navItems} switchLabel={switchLabel} onSwitch={onSwitch} switchVariant={switchVariant} />
    <main className="md:ml-64 min-h-screen relative pb-24 md:pb-lg">
      <Header
        userAvatar={userAvatar}
        showStatusToggle={showStatusToggle}
        isOnline={isOnline}
        onStatusToggle={onStatusToggle}
      />
      <div className="p-md md:p-lg space-y-lg max-w-container-max mx-auto">{children}</div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-lg border-t border-outline-variant/30 px-md py-xs flex justify-around items-center z-50">
        <Link to="/customer" className="flex flex-col items-center gap-xs p-2 text-primary font-bold">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            dashboard
          </span>
          <span className="text-[10px]">Trang chủ</span>
        </Link>
        <button className="flex flex-col items-center gap-xs p-2 text-on-surface-variant">
          <span className="material-symbols-outlined">calendar_today</span>
          <span className="text-[10px]">Đơn hàng</span>
        </button>
        <button className="relative flex flex-col items-center gap-xs p-2 text-on-surface-variant">
          <span className="material-symbols-outlined">mail</span>
          <span className="text-[10px]">Hộp thư</span>
          <span className="absolute top-1 right-3 w-2 h-2 bg-error rounded-full" />
        </button>
        <Link to="/customer/profile" className="flex flex-col items-center gap-xs p-2 text-on-surface-variant">
          <span className="material-symbols-outlined">person</span>
          <span className="text-[10px]">Hồ sơ</span>
        </Link>
      </nav>
    </main>

    <button className="md:hidden fixed bottom-24 right-6 w-14 h-14 bg-primary text-on-primary rounded-full shadow-2xl flex items-center justify-center z-40 active:scale-90 transition-transform">
      <span className="material-symbols-outlined">add</span>
    </button>
  </div>
);
