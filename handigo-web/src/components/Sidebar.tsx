import { Link, useLocation } from 'react-router-dom';
import logoImg from '../assets/logo.png';
import { isNavItemActive } from '@/config/sidebarNavigation';

export interface NavItem {
  icon: string;
  label: string;
  path: string;
  matchPrefix?: boolean;
}

export interface SidebarProps {
  navItems: NavItem[];
  switchLabel: string;
  onSwitch: () => void;
  switchVariant?: 'outline' | 'gradient';
}

export function Sidebar({
  navItems,
  switchLabel,
  onSwitch,
  switchVariant = 'outline',
}: SidebarProps) {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 z-[60] hidden h-screen w-72 flex-col gap-5 border-r border-outline-variant/30 bg-white p-6 shadow-[4px_0_24px_rgba(19,27,46,0.04)] lg:flex">
      <Link to="/" className="mb-2 flex items-center gap-3 rounded-xl px-1 py-2">
        <img src={logoImg} alt="" className="h-9 w-9 object-contain" />
        <div>
          <h1 className="font-headline-md text-xl font-bold leading-none text-primary">Handigo</h1>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-on-surface-variant">
            Dịch vụ tại nhà
          </p>
        </div>
      </Link>

      <nav className="flex flex-grow flex-col gap-1.5">
        {navItems.map((item) => {
          const active = isNavItemActive(location.pathname, item);
          const className = `flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 transition-all ${
            active
              ? 'bg-primary font-semibold text-on-primary shadow-[0_8px_18px_rgba(53,37,205,0.18)]'
              : 'text-on-surface-variant hover:bg-surface-container-low hover:text-primary'
          }`;

          if (item.path === '#') {
            return (
              <span
                key={item.label}
                className={`${className} cursor-not-allowed opacity-50`}
                aria-disabled="true"
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
              </span>
            );
          }

          return (
            <Link key={item.label} to={item.path} className={className}>
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

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
    </aside>
  );
}
