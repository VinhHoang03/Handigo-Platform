import { RefreshCw } from "lucide-react";
import { useLocation } from "react-router-dom";
import { adminNavItems, isNavItemActive } from "@/components/common/dashboard/dashboardNavigation";

export function AdminPageTitle({ title }: { title: string }) {
  const { pathname } = useLocation();
  const Icon = adminNavItems.find((item) => isNavItemActive(pathname, item))?.icon;

  return (
    <h1 className="admin-page-title" title={title}>
      {Icon && <Icon aria-hidden="true" size={32} className="shrink-0 text-black" />}
      <span>{title}</span>
    </h1>
  );
}

export function AdminRefreshButton({
  onRefresh,
  loading = false,
}: {
  onRefresh: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={loading}
      className="ml-auto inline-flex items-center justify-center gap-2 self-end rounded-xl border border-outline-variant text-primary hover:bg-surface-container-low disabled:opacity-40 lg:self-center"
    >
      <RefreshCw aria-hidden="true" size={18} className={loading ? "animate-spin motion-reduce:animate-none" : ""} />
      Làm mới
    </button>
  );
}
