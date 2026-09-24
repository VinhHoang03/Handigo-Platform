import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { AgentCustomerCareService as care } from "../../../services/agentCustomerCare.service";
import { ticketQuerySchema } from "./customer-care.schemas";

export const getMySupportTicketsTool: AgentTool<z.infer<typeof ticketQuerySchema>> = {
  name: "get_my_support_tickets",
  description: "Liệt kê yêu cầu hỗ trợ của chính khách, 10 mục mỗi trang; lọc trạng thái, nhóm và độ ưu tiên. Dùng để tìm ID trước khi xem, phản hồi hoặc hủy.",
  inputSchema: ticketQuerySchema,
  roles: ["CUSTOMER"],
  mutates: false,
  requiresConfirmation: false,
  execute: (context, args) => care.listTickets(context.user.id, { ...args, limit: 10 }),
};
