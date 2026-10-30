import api from "@/api/client";
import type {
  AdminRevenue,
  AdminRevenueInsights,
  RevenueQuery,
} from "../types/adminRevenue.types";

const data = <T>(response: { data: { data: T } }) => response.data.data;

export const adminRevenueApi = {
  getInsights: async (query: RevenueQuery) =>
    data<AdminRevenueInsights>(await api.get("/dashboard/revenue-insights", { params: query })),
  getRevenue: async (query: RevenueQuery) =>
    data<AdminRevenue>(await api.get("/dashboard/revenue", { params: query })),
};
