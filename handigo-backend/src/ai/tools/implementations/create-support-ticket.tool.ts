import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { AgentCustomerCareService as care, agentTicketSchema } from "../../../services/agentCustomerCare.service";
import { receipt } from "./customer-care.reply";

export const createSupportTicketTool: AgentTool<z.infer<typeof agentTicketSchema>> = {
  name: "create_support_ticket",
  description: "Gửi yêu cầu hỗ trợ về tài khoản, thanh toán, đơn, kỹ thuật hoặc bảo mật. Cần tiêu đề và mô tả khách cung cấp; orderId chỉ dùng khi đã xác định đúng đơn. Luôn xem trước và xác nhận. Không nhận tệp qua chat.",
  inputSchema: agentTicketSchema,
  roles: ["CUSTOMER"],
  mutates: true,
  requiresConfirmation: true,
  preview: (context, args) => care.previewTicket(context.user.id, args),
  execute: (context, args) => care.createTicket(context.user.id, args),
  reply: receipt("Đã gửi yêu cầu hỗ trợ, đang chờ bộ phận hỗ trợ xử lý."),
};
