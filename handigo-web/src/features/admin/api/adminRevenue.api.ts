import api from "@/api/client";
import type {
  AdminRevenue,
  RevenueQuery,
} from "../types/adminRevenue.types";

const data = <T>(response: { data: { data: T } }) => response.data.data;

export const adminRevenueApi = {
  getRevenue: async (query: RevenueQuery) =>
    data<AdminRevenue>(await api.get("/dashboard/revenue", { params: query })),
};
