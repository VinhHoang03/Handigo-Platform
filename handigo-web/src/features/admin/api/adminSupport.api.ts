import api from "@/api/client";
import type { AdminUser, ListResult } from "../types/admin.types";
import type {
  AdminSupportTicket,
  SupportTicketList,
  SupportTicketQuery,
  SupportTicketStatus,
} from "../types/adminSupport.types";

const data = <T>(response: { data: { data: T } }) => response.data.data;

export const adminSupportApi = {
  getTickets: async (query: SupportTicketQuery) =>
    data<SupportTicketList>(
      await api.get("/admin/support-tickets", { params: query }),
    ),
  getTicket: async (id: string) =>
    data<AdminSupportTicket>(await api.get("/admin/support-tickets/" + id)),
  getActiveAdmins: async () =>
    data<ListResult<AdminUser>>(
      await api.get("/admin/users", {
        params: { role: "ADMIN", status: "active", page: 1, limit: 50 },
      }),
    ),
  assignTicket: async (id: string, assignedAdminId: string) =>
    data<AdminSupportTicket>(
      await api.patch("/admin/support-tickets/" + id + "/assign", {
        assignedAdminId,
      }),
    ),
  updateStatus: async (
    id: string,
    status: SupportTicketStatus,
    resolutionNote?: string,
  ) =>
    data<AdminSupportTicket>(
      await api.patch("/admin/support-tickets/" + id + "/status", {
        status,
        resolutionNote,
      }),
    ),
  respond: async (id: string, message: string) =>
    data<AdminSupportTicket>(
      await api.post("/admin/support-tickets/" + id + "/responses", {
        message,
      }),
    ),
};
