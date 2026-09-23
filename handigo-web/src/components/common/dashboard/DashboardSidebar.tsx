import { Link, useLocation } from "react-router-dom";
import {
  dashboardHomePath,
  dashboardSubtitle,
  isNavItemActive,
} from "./dashboardNavigation";
import type { DashboardNavItem, DashboardRole } from "./dashboard.types";
import { HardHat } from "lucide-react";

interface DashboardSidebarProps {
  role: DashboardRole;
  navItems: DashboardNavItem[];
  switchLabel?: string;
  onSwitch?: () => void;
  switchVariant?: "outline" | "gradient";
}

export function DashboardSidebar({
  role,
  navItems,
  switchLabel,
  onSwitch,
  switchVariant = "outline",
}: DashboardSidebarProps) {
  const location = useLocation();
  const homePath = dashboardHomePath[role];
  const subtitle = dashboardSubtitle[role];
  const sidebarTopClass = role === "PROVIDER" ? "top-6" : "top-28";

  return (
    <aside
      className={`fixed bottom-6 left-4 z-40 hidden w-72 flex-col gap-5 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest/92 p-5 shadow-[0_14px_40px_rgba(19,27,46,0.08)] backdrop-blur-xl lg:flex xl:left-6 ${sidebarTopClass}`}
    >
      <Link
        to={homePath}
        className="mb-1 flex items-center gap-3 rounded-xl px-1 py-2"
      >
        <div>
          <h1 className="font-headline-md text-xl font-bold leading-none text-primary">
            Handigo
          </h1>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-on-surface-variant">
            {subtitle}
          </p>
        </div>
      </Link>

      <nav className="flex min-h-0 flex-grow flex-col gap-1.5 overflow-y-auto pr-1">
        {navItems.map((item) => {
          const active = isNavItemActive(location.pathname, item);
          return (
            <Link
              key={item.label}
              to={item.path}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 transition-all ${
                active
                  ? "bg-primary font-semibold text-on-primary shadow-[0_8px_18px_rgba(53,37,205,0.18)]"
                  : "text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
              }`}
            >
              <item.icon aria-hidden="true" size={24} className="shrink-0" />
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
            switchVariant === "gradient"
              ? "btn-primary mt-auto w-full bg-gradient-to-r from-primary to-secondary"
              : "btn-secondary mt-auto w-full"
          }
        >
          {switchVariant === "gradient" && (
            <HardHat aria-hidden="true" size={16} />
          )}
          {switchLabel}
        </button>
      )}
    </aside>
  );
}
