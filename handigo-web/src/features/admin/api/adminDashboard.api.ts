import api from "@/api/client";
import { unwrap } from "@/api/response";
import type { AdminDashboardInsights, AdminMonthlyTrend, AdminUserPresence, AdminPendingCounts } from "../types/adminDashboard.types";
import type { AdminFeedbackDetail } from "@/features/feedback/api/feedback.api";

export const adminDashboardApi = {
  pendingCounts: async (signal?: AbortSignal) => unwrap<AdminPendingCounts>(await api.get("/dashboard/pending-work", { signal })),
  monthlyTrend: async (query: { fromDate?: string; toDate?: string }) =>
    unwrap<AdminMonthlyTrend>(await api.get('/dashboard/monthly-trend', { params: query })),
  orderDetail: async (id: string) => unwrap<Omit<AdminFeedbackDetail, 'feedback'>>(await api.get(`/admin/orders/${id}`)),
  insights: async (query: { fromDate?: string; toDate?: string }) =>
    unwrap<AdminDashboardInsights>(await api.get("/dashboard/insights", { params: query })),
  presence: async () => unwrap<AdminUserPresence>(await api.get("/dashboard/presence")),
};
