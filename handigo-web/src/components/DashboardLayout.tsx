import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import logoImg from '../assets/logo.png';
import { Navbar, type AppRole } from './common/Navbar';
import { useAuthStore } from '../features/auth/store/auth.store';

interface NavItem {
  icon: string;
  label: string;
  path: string;
}

interface SidebarProps {
  navItems: NavItem[];
  switchLabel?: string;
  onSwitch?: () => void;
  switchVariant?: 'outline' | 'gradient';
}

const normalizeRole = (role?: string | null): AppRole | undefined => {
  const value = role?.toUpperCase();
  if (value === 'CUSTOMER' || value === 'PROVIDER' || value === 'ADMIN') {
    return value;
  }
  return undefined;
};

export function Sidebar({
  navItems,
  switchLabel,
  onSwitch,
  switchVariant = 'outline',
}: SidebarProps) {
  const location = useLocation();

  return (
    <aside className="fixed bottom-6 left-4 top-28 z-40 hidden w-72 flex-col gap-5 rounded-2xl border border-outline-variant/30 bg-white/92 p-5 shadow-[0_14px_40px_rgba(19,27,46,0.08)] backdrop-blur-xl lg:flex xl:left-6">
      <Link to="/admin/users" className="mb-1 flex items-center gap-3 rounded-xl px-1 py-2">
        <img src={logoImg} alt="" className="h-9 w-9 object-contain" />
        <div>
          <h1 className="font-headline-md text-xl font-bold leading-none text-primary">Handigo</h1>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-on-surface-variant">
            Quản trị hệ thống
          </p>
        </div>
      </Link>

      <nav className="flex min-h-0 flex-grow flex-col gap-1.5 overflow-y-auto pr-1">
        {navItems.map((item) => {
          const active =
            item.path !== '#' &&
            (location.pathname === item.path || location.pathname.startsWith(`${item.path}/`));
          return (
            <Link
              key={item.label}
              to={item.path}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 transition-all ${
                active
                  ? 'bg-primary font-semibold text-on-primary shadow-[0_8px_18px_rgba(53,37,205,0.18)]'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-primary'
              }`}
            >
              <span className="material-symbols-outlined shrink-0">{item.icon}</span>
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
            switchVariant === 'gradient'
              ? 'btn-primary mt-auto w-full bg-gradient-to-r from-primary to-secondary'
              : 'btn-secondary mt-auto w-full'
          }
        >
          {switchVariant === 'gradient' && (
            <span className="material-symbols-outlined text-base">engineering</span>
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
  switchVariant?: 'outline' | 'gradient';
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
  const isAdmin = currentRole === 'ADMIN';

  return (
    <div className="min-h-screen overflow-x-hidden bg-background font-body-md text-body-md">
      <Navbar
        role={currentRole}
        userAvatar={userAvatar}
        showStatusToggle={showStatusToggle}
        isOnline={isOnline}
        onStatusToggle={onStatusToggle}
      />

      {isAdmin && (
        <Sidebar
          navItems={navItems}
          switchLabel={switchLabel}
          onSwitch={onSwitch}
          switchVariant={switchVariant}
        />
      )}

      <main className={`relative min-h-screen pb-12 pt-32 ${isAdmin ? 'lg:pl-80 xl:pl-[21rem]' : ''}`}>
        <div
          className={`mx-auto space-y-8 px-4 sm:px-5 ${
            isAdmin ? 'max-w-6xl lg:px-5 xl:px-6' : 'max-w-container-max lg:px-8'
          }`}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
