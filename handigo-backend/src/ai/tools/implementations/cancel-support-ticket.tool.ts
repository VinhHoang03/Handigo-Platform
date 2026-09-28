import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { AgentCustomerCareService as care } from "../../../services/agentCustomerCare.service";
import { ticketIdSchema } from "./customer-care.schemas";
import { receipt } from "./customer-care.reply";

export const cancelSupportTicketTool: AgentTool<z.infer<typeof ticketIdSchema>> = {
  name: "cancel_support_ticket",
  description: "Hủy yêu cầu hỗ trợ chưa kết thúc khi khách yêu cầu rõ và xác nhận. Không hủy đơn dịch vụ.",
  inputSchema: ticketIdSchema,
  roles: ["CUSTOMER"],
  mutates: true,
  requiresConfirmation: true,
  preview: (context, args) => care.previewTicketAction(context.user.id, args.ticketId),
  execute: (context, args) => care.cancelTicket(context.user.id, args.ticketId),
  reply: receipt("Đã hủy yêu cầu hỗ trợ."),
};
