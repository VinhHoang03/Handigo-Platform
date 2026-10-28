import { Link } from "react-router-dom";
import { ArrowUpRight, ShieldCheck, LifeBuoy, Gavel, Lightbulb, Wallet } from "lucide-react";
import { ChartCard, chartMoney, chartNumber } from "@/components/common/chart";
import type { AdminDashboardInsights } from "../../types/adminDashboard.types";

export function DashboardPendingWork({ data }: { data: AdminDashboardInsights["pendingWork"] }) {
  const items = [
    { label: "Hồ sơ chờ xét duyệt", value: data.applications, path: "/admin/provider-applications", icon: ShieldCheck, note: "Hồ sơ mới và hồ sơ gửi lại" },
    { label: "Hỗ trợ chưa phản hồi", value: data.support, path: "/admin/support", icon: LifeBuoy, note: "Chưa có phản hồi từ quản trị viên" },
    { label: "Khiếu nại chưa giải quyết", value: data.complaints, path: "/admin/cases", icon: Gavel, note: "Chờ xử lý, bổ sung bằng chứng hoặc xem xét" },
    { label: "Đề xuất chờ duyệt", value: data.suggestions, path: "/admin/service-suggestions", icon: Lightbulb, note: "Đề xuất danh mục và dịch vụ" },
    { label: "Yêu cầu rút chờ duyệt", value: data.withdrawals, path: "/admin/withdrawals", icon: Wallet, note: chartMoney.format(data.withdrawalAmount) },
  ];
  return <ChartCard title="Việc cần xử lý" description="Hàng đợi hiện tại trên toàn hệ thống, không phụ thuộc khoảng ngày thống kê.">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
      {items.map(({ label, value, path, icon: Icon, note }) => <Link key={path} to={path}
        className="min-w-0 rounded-xl border border-outline-variant/40 p-4 hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-primary">
        <div className="flex items-center justify-between gap-2 text-primary"><Icon size={20} aria-hidden="true" /><ArrowUpRight size={16} aria-hidden="true" /></div>
        <p className="mt-3 text-sm font-medium">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{chartNumber.format(value)}</p>
        <p className="mt-2 break-words text-xs text-on-surface-variant">{note}</p>
      </Link>)}
    </div>
  </ChartCard>;
}
