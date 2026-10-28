import type { DashboardNavItem } from "@/components/common/dashboard/dashboard.types";
import type { AdminPendingCounts } from "../types/adminDashboard.types";

export const withAdminPendingCounts = (items: DashboardNavItem[], counts: AdminPendingCounts | null, stale = false): DashboardNavItem[] => {
  if (!counts) return items;
  const badges: Record<string, { count: number; label: string }> = {
    "/admin": { count: counts.attentionOrders, label: `${counts.attentionOrders} đơn cần chú ý` },
    "/admin/provider-applications": { count: counts.applications, label: `${counts.applications} hồ sơ chờ xét duyệt` },
    "/admin/service-suggestions": { count: counts.suggestions, label: `${counts.suggestions} đề xuất chờ duyệt` },
    "/admin/withdrawals": { count: counts.withdrawals, label: `${counts.withdrawals} yêu cầu rút tiền chờ duyệt` },
    "/admin/support": { count: counts.support, label: `${counts.support} yêu cầu hỗ trợ chưa được phản hồi` },
    "/admin/cases": { count: counts.complaints + counts.reports, label: `${counts.complaints} khiếu nại chưa giải quyết và ${counts.reports} báo cáo chờ xem xét` },
    "/admin/payments": { count: counts.refunds, label: `${counts.refunds} giao dịch hoàn tiền lỗi hoặc cần xử lý thủ công` },
  };
  return items.map((item) => {
    const badge = badges[item.path];
    return badge ? { ...item, pendingCount: badge.count, pendingLabel: badge.label, pendingStale: stale } : item;
  });
};

export const isPendingWorkMutation = (method?: string, url?: string) =>
  ["post", "put", "patch", "delete"].includes(method?.toLowerCase() ?? "") &&
  /^\/(?:admin|withdrawals|service-suggestions|payments|orders|support-tickets|complaints|reports|violations)(?:\/|\?|$)/.test(url ?? "");
