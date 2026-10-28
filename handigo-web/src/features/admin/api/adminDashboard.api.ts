import api from "@/api/client";
import { unwrap } from "@/api/response";
import type { AdminDashboardInsights, AdminUserPresence } from "../types/adminDashboard.types";

export const adminDashboardApi = {
  insights: async (query: { fromDate?: string; toDate?: string }) =>
    unwrap<AdminDashboardInsights>(await api.get("/dashboard/insights", { params: query })),
  presence: async () => unwrap<AdminUserPresence>(await api.get("/dashboard/presence")),
};
