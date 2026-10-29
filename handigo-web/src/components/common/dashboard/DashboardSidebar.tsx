import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { createPortal } from "react-dom";
import {
  dashboardHomePath,
  dashboardSubtitle,
  isNavItemActive,
  getDashboardNavLabel,
} from "./dashboardNavigation";
import type { DashboardNavItem, DashboardRole } from "./dashboard.types";
import { ChevronLeft, ChevronsRight, HardHat, Home } from "lucide-react";
import { NavPendingBadge } from "./NavPendingBadge";

interface DashboardSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
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
  collapsed = false,
  onToggle,
}: DashboardSidebarProps) {
  const location = useLocation();
  const isAdmin = role === "ADMIN";
  const isCollapsed = isAdmin && collapsed;
  const [tooltip, setTooltip] = useState<{ label: string; top: number } | null>(null);
  const showTooltip = (element: HTMLElement, label: string) => {
    if (isCollapsed) {
      const bounds = element.getBoundingClientRect();
      setTooltip({ label, top: bounds.top + bounds.height / 2 });
    }
  };
  const homePath = dashboardHomePath[role];
  const subtitle = dashboardSubtitle[role];
  const sidebarTopClass = role === "PROVIDER" ? "top-6" : "top-28";
  const sidebarSurfaceClass = role === "PROVIDER"
    ? "bg-surface-container-lowest/20 backdrop-blur-[1px]"
    : "bg-surface-container-lowest/92 backdrop-blur-xl";

  return (
    <aside
      aria-label="Điều hướng bảng điều khiển"
      className={`fixed hidden flex-col gap-5 border border-outline-variant/30 shadow-[0_14px_40px_rgba(19,27,46,0.08)] transition-[width] duration-300 motion-reduce:transition-none lg:flex ${isAdmin ? `inset-y-0 left-0 z-[75] border-y-0 border-l-0 ${isCollapsed ? "w-20 p-3" : "w-72 p-5"}` : `bottom-6 left-4 z-40 w-72 rounded-2xl p-5 xl:left-6 ${sidebarTopClass}`} ${sidebarSurfaceClass}`}
    >
      <div className="mb-1 flex min-h-12 shrink-0 items-center justify-between gap-2">
        {!isCollapsed && (
          <Link
            to={homePath}
            aria-label={`Handigo - ${subtitle}`}
            className="flex min-h-12 items-center gap-3 rounded-xl px-1 py-2"
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
        )}
        {isAdmin && onToggle && (
          <button
            type="button"
            onClick={() => { setTooltip(null); onToggle(); }}
            aria-label={isCollapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
            aria-expanded={!isCollapsed}
            aria-controls="admin-sidebar-navigation"
            title={isCollapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
            className={`flex shrink-0 items-center justify-center rounded-xl text-primary hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary ${isCollapsed ? "min-h-12 w-full" : "size-10"}`}
          >
            {isCollapsed ? <ChevronsRight aria-hidden="true" size={24} /> : <ChevronLeft aria-hidden="true" size={24} />}
          </button>
        )}
      </div>

      <nav id={isAdmin ? "admin-sidebar-navigation" : undefined} onScroll={() => setTooltip(null)} className={`flex min-h-0 flex-grow flex-col gap-1.5 overflow-y-auto ${isAdmin ? "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : ""} ${isCollapsed ? "" : "pr-1"}`}>
        {navItems.map((item) => {
          const active = isNavItemActive(location.pathname, item);
          const accessibleLabel = getDashboardNavLabel(item);
          return (
            <Link
              key={item.label}
              to={item.path}
              aria-label={accessibleLabel}
              title={!isCollapsed && item.pendingCount && item.pendingCount > 0 ? accessibleLabel : undefined}
              aria-current={active ? "page" : undefined}
              onMouseEnter={(event) => showTooltip(event.currentTarget, accessibleLabel)}
              onMouseLeave={() => setTooltip(null)}
              onFocus={(event) => showTooltip(event.currentTarget, accessibleLabel)}
              onBlur={() => setTooltip(null)}
              onClick={() => setTooltip(null)}
              onKeyDown={(event) => { if (event.key === "Escape") setTooltip(null); }}
              className={`flex min-h-12 shrink-0 items-center gap-3 rounded-xl py-3 transition-colors ${isCollapsed ? "justify-center px-0" : "px-4"} ${
                active
                  ? "bg-primary font-semibold text-on-primary shadow-[0_8px_18px_rgba(53,37,205,0.18)]"
                  : "text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
              }`}
            >
              <span className="relative inline-flex shrink-0">
                <item.icon aria-hidden="true" size={24} />
                {isCollapsed && <NavPendingBadge count={item.pendingCount} compact stale={item.pendingStale} />}
              </span>
              {!isCollapsed && <>
                <span className="min-w-0 flex-1 text-sm font-medium">{item.label}</span>
                <NavPendingBadge count={item.pendingCount} stale={item.pendingStale} />
              </>}
            </Link>
          );
        })}
      </nav>

      {switchLabel && onSwitch && (
        <button
          type="button"
          onClick={onSwitch}
          aria-label={isCollapsed ? switchLabel : undefined}
          onMouseEnter={(event) => showTooltip(event.currentTarget, switchLabel)}
          onMouseLeave={() => setTooltip(null)}
          onFocus={(event) => showTooltip(event.currentTarget, switchLabel)}
          onBlur={() => setTooltip(null)}
          className={
            isCollapsed ? "btn-secondary mt-auto min-h-12 w-full shrink-0 px-0" : switchVariant === "gradient"
              ? "btn-primary mt-auto w-full bg-gradient-to-r from-primary to-secondary"
              : "btn-secondary mt-auto w-full"
          }
        >
          {isCollapsed ? <Home aria-hidden="true" size={24} /> : switchVariant === "gradient" && (
            <HardHat aria-hidden="true" size={16} />
          )}
          {!isCollapsed && switchLabel}
        </button>
      )}
      {isCollapsed && tooltip && createPortal(
        <div role="tooltip" style={{ top: tooltip.top }} className="pointer-events-none fixed left-[5.5rem] z-[100] hidden max-w-[min(24rem,calc(100vw-6rem))] -translate-y-1/2 break-words rounded-lg bg-on-surface px-3 py-2 text-sm text-surface-container-lowest shadow-lg lg:block">
          {tooltip.label}
        </div>,
        document.body,
      )}
    </aside>
  );
}
