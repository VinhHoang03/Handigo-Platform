import { type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { isNavItemActive } from '@/config/sidebarNavigation';
import { Header } from './Header';
import { Sidebar, type NavItem } from './Sidebar';

interface DashboardLayoutProps {
  children: ReactNode;
  navItems: NavItem[];
  switchLabel: string;
  onSwitch: () => void;
  switchVariant?: 'outline' | 'gradient';
  userAvatar?: string;
  showStatusToggle?: boolean;
  isOnline?: boolean;
  onStatusToggle?: () => void;
}

export function DashboardLayout({
  children,
  navItems,
  switchLabel,
  onSwitch,
  switchVariant,
  userAvatar,
  showStatusToggle,
  isOnline,
  onStatusToggle,
}: DashboardLayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen overflow-x-hidden bg-background font-body-md text-body-md">
      <Sidebar
        navItems={navItems}
        switchLabel={switchLabel}
        onSwitch={onSwitch}
        switchVariant={switchVariant}
      />
      <main className="relative min-h-screen pb-28 lg:ml-72 lg:pb-12">
        <Header
          userAvatar={userAvatar}
          showStatusToggle={showStatusToggle}
          isOnline={isOnline}
          onStatusToggle={onStatusToggle}
        />
        <div className="mx-auto mt-8 max-w-container-max space-y-12 px-4 sm:px-6 lg:px-8">
          {children}
        </div>

        <nav className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-4 border-t border-outline-variant/30 bg-white/92 px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden">
          {navItems.slice(0, 4).map((item) => {
            const active = isNavItemActive(location.pathname, item);
            const className = `flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-center ${
              active ? 'bg-primary/10 text-primary' : 'text-on-surface-variant'
            }`;

            if (item.path === '#') {
              return (
                <span
                  key={item.label}
                  className={`${className} cursor-not-allowed opacity-50`}
                  aria-disabled="true"
                >
                  <span className="material-symbols-outlined text-xl">{item.icon}</span>
                  <span className="max-w-full truncate text-[10px] font-medium">{item.label}</span>
                </span>
              );
            }

            return (
              <Link key={item.label} to={item.path} className={className}>
                <span className="material-symbols-outlined text-xl">{item.icon}</span>
                <span className="max-w-full truncate text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
