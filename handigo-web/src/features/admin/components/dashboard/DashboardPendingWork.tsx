import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { ArrowUpRight, ShieldCheck, LifeBuoy, Gavel, Lightbulb, Wallet } from "lucide-react";
import { chartMoney, chartNumber } from "@/components/common/chart";
import type { AdminDashboardInsights } from "../../types/adminDashboard.types";

export function DashboardPendingWork({ data, children }: { data?: AdminDashboardInsights["pendingWork"]; children?: ReactNode }) {
  const items = [
    { label: "Hồ sơ chờ xét duyệt", value: data?.applications, path: "/admin/provider-applications", icon: ShieldCheck, note: "Mới / gửi lại" },
    { label: "Hỗ trợ chưa phản hồi", value: data?.support, path: "/admin/support", icon: LifeBuoy, note: "Chờ phản hồi" },
    { label: "Báo cáo chất lượng chưa giải quyết", value: data?.complaints, path: "/admin/cases?reportType=service_quality", icon: Gavel, note: "Chờ xử lý" },
    { label: "Đề xuất chờ duyệt", value: data?.suggestions, path: "/admin/service-suggestions", icon: Lightbulb, note: "Danh mục / dịch vụ" },
    { label: "Yêu cầu rút chờ duyệt", value: data?.withdrawals, path: "/admin/withdrawals", icon: Wallet, note: data ? chartMoney.format(data.withdrawalAmount) : "—" },
  ];
  const prioritized = [...items].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  return <div className="dashboard-operations">
    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Chỉ số hệ thống</h3>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 min-[112.5rem]:grid-cols-5">{children}</div>
    <h3 className="dashboard-queue-heading mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Hàng đợi hiện tại <span>(cần xử lý)</span></h3>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 min-[112.5rem]:grid-cols-5">
      {prioritized.map(({ label, value, path, icon: Icon, note }) => <Link key={path} to={path}
        data-kind={path.split('/').at(-1)} data-active={(value ?? 0) > 0}
        className={`dashboard-queue-card min-w-0 rounded-xl border p-3 hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-primary ${(value ?? 0) > 0 ? 'border-warning/40 bg-warning-container/30' : 'border-outline-variant/40 text-on-surface-variant'}`}>
        <div className="flex items-center justify-between gap-2 text-primary"><Icon size={20} aria-hidden="true" /><ArrowUpRight size={16} aria-hidden="true" /></div>
        <p className="mt-2 text-sm font-medium">{label}</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-2xl font-bold tabular-nums">{value == null ? "—" : chartNumber.format(value)}</p>
          <p className="max-w-[60%] break-words text-right text-xs text-on-surface-variant">{note}</p>
        </div>
      </Link>)}
    </div>
  </div>;
}
