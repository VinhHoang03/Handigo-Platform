import React, { useState, useRef, useEffect, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logoImg from '../assets/logo.png';
import { useAuthStore } from '../features/auth/store/auth.store';
import { authService } from '../features/auth/services/auth.service';

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

export const Sidebar: React.FC<SidebarProps> = ({ navItems, switchLabel, onSwitch, switchVariant = 'outline' }) => {
  const location = useLocation();

  return (
    <aside className="hidden md:flex flex-col h-screen p-md gap-4 fixed left-0 top-0 w-64 bg-surface dark:bg-on-background border-r border-outline-variant/30 z-[60] shadow-sm">
      <div className="flex items-center gap-2 mb-base">
        <img src={logoImg} alt="FixNow Logo" className="h-8 w-auto" />
        <div className="flex flex-col">
          <h1 className="font-headline-md text-headline-md font-bold text-primary dark:text-primary-fixed leading-none">FixNow</h1>
          <p className="text-[10px] font-label-md text-on-surface-variant">Trung Tâm Dịch Vụ Cao Cấp</p>
        </div>
      </div>

      <nav className="flex-grow flex flex-col gap-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.label}
              to={item.path}
              className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${isActive
                ? 'bg-primary-container text-on-primary-container dark:bg-primary dark:text-on-primary font-semibold scale-[0.98]'
                : 'text-on-surface-variant dark:text-outline-variant hover:bg-surface-container-low hover:translate-x-1'
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
          className="mt-auto w-full py-3 px-4 rounded-xl font-label-md text-label-md text-white font-bold bg-gradient-to-r from-primary to-secondary hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>engineering</span>
          {switchLabel}
        </button>
      ) : (
        <button
          onClick={onSwitch}
          className="mt-auto w-full py-3 px-4 border border-primary text-primary rounded-xl font-label-md text-label-md hover:bg-primary/5 transition-colors"
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

export const Header: React.FC<HeaderProps> = ({ userAvatar, showStatusToggle, isOnline, onStatusToggle }) => {
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
    <header className="sticky top-4 z-50 flex items-center justify-between px-md py-base mx-auto rounded-xl max-w-[calc(100%-48px)] bg-surface/80 dark:bg-on-background/80 backdrop-blur-md border border-outline-variant/50 dark:border-outline-variant/20 shadow-md">
      <div className="flex items-center gap-4 flex-grow">
        <div className="md:hidden flex items-center gap-2">
          <img src={logoImg} alt="FixNow Logo" className="h-6 w-auto" />
          <span className="font-headline-md text-headline-md font-bold text-primary leading-none">FixNow</span>
        </div>
        <div className="relative w-full max-w-md hidden md:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
          <input
            className="w-full bg-surface-container-low border-none rounded-full py-2 pl-10 pr-4 focus:ring-2 focus:ring-primary transition-all text-label-md outline-none"
            placeholder="Tìm kiếm..."
            type="text"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {showStatusToggle && (
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
              <div className="w-11 h-6 bg-outline-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        )}
        <button className="material-symbols-outlined text-on-surface-variant hover:bg-surface-container-low p-2 rounded-full transition-all">notifications</button>
        <button className="material-symbols-outlined text-on-surface-variant hover:bg-surface-container-low p-2 rounded-full transition-all">chat_bubble</button>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="h-8 w-8 rounded-full overflow-hidden bg-surface-container-highest border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary transition-all"
          >
            <img alt="User avatar" src={userAvatar} className="w-full h-full object-cover" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-surface rounded-xl shadow-lg border border-outline-variant/30 py-2 z-50">
              <div className="px-4 py-3 border-b border-outline-variant/20">
                <p className="font-label-md text-on-surface font-semibold truncate">{user?.fullName || 'Người dùng'}</p>
                <p className="font-body-sm text-on-surface-variant truncate">{user?.email || 'N/A'}</p>
                <p className="font-label-sm text-primary mt-1">{user?.role === 'CUSTOMER' ? 'Khách hàng' : user?.role === 'PROVIDER' ? 'Nhà cung cấp' : user?.role}</p>
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
          )}
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
  onStatusToggle
}) => {
  return (
    <div className="font-body-md text-body-md overflow-x-hidden min-h-screen bg-background">
      <Sidebar navItems={navItems} switchLabel={switchLabel} onSwitch={onSwitch} switchVariant={switchVariant} />
      <main className="md:ml-64 min-h-screen relative pb-lg">
        <Header
          userAvatar={userAvatar}
          showStatusToggle={showStatusToggle}
          isOnline={isOnline}
          onStatusToggle={onStatusToggle}
        />
        <div className="px-md mt-lg space-y-xl max-w-container-max mx-auto">
          {children}
        </div>

        {/* Bottom Nav for Mobile */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-md border-t border-outline-variant/30 px-base py-sm flex justify-around items-center z-50">
          <Link to="/" className="flex flex-col items-center gap-1 text-primary">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>grid_view</span>
            <span className="text-[10px] font-bold">Trang chủ</span>
          </Link>
          <button className="flex flex-col items-center gap-1 text-on-surface-variant">
            <span className="material-symbols-outlined">event_available</span>
            <span className="text-[10px]">Đặt lịch</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-on-surface-variant">
            <span className="material-symbols-outlined">mail</span>
            <span className="text-[10px]">Tin nhắn</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-on-surface-variant">
            <span className="material-symbols-outlined">account_circle</span>
            <span className="text-[10px]">Hồ sơ</span>
          </button>
        </nav>
      </main>

      {/* FAB */}
      <button className="fixed bottom-24 md:bottom-8 right-6 md:right-8 h-14 w-14 rounded-full bg-primary text-on-primary shadow-xl flex items-center justify-center z-50 active:scale-95 transition-all">
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>
    </div>
  );
};
