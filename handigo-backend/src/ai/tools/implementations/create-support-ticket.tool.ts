import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { AgentCustomerCareService as care, agentTicketSchema } from "../../../services/agentCustomerCare.service";
import { receipt } from "./customer-care.reply";
import { agentRequestAttachments } from "../../agent/booking-attachments";

export const createSupportTicketTool: AgentTool<z.infer<typeof agentTicketSchema>> = {
  name: "create_support_ticket",
  description: "Gửi yêu cầu hỗ trợ về thanh toán, tài khoản, lỗi ứng dụng, đề nghị xem xét hoặc hướng dẫn. Chỉ cần loại và mô tả; không yêu cầu tiêu đề hoặc mức ưu tiên. Backend tự gán ưu tiên theo loại. orderId không bắt buộc, chỉ chọn khi hỗ trợ thanh toán của một đơn đã xác định. Luôn xem trước và xác nhận, hỗ trợ ảnh đã tải trong phiên chat.",
  inputSchema: agentTicketSchema,
  roles: ["CUSTOMER"],
  mutates: true,
  requiresConfirmation: true,
  preview: (context, args) => care.previewTicket(context.user.id, { ...args, customerAttachments: agentRequestAttachments(context.session, args.customerAttachments) }),
  execute: (context, args) => care.createTicket(context.user.id, { ...args, customerAttachments: agentRequestAttachments(context.session, args.customerAttachments) }, context.sessionId, context.actionId),
  reconcile: (context) => context.actionId ? care.reconcileCreated(context.user.id, context.sessionId, context.actionId, "ticket") : Promise.resolve(null),
  reply: receipt("Đã gửi yêu cầu hỗ trợ, đang chờ bộ phận hỗ trợ xử lý."),
};
