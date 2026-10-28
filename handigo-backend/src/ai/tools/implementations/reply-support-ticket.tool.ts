import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { AgentCustomerCareService as care } from "../../../services/agentCustomerCare.service";
import { responseSchema } from "./customer-care.schemas";
import { receipt } from "./customer-care.reply";
import { agentRequestAttachments } from "../../agent/booking-attachments";

export const replySupportTicketTool: AgentTool<z.infer<typeof responseSchema>> = {
  name: "reply_support_ticket",
  description: "Gửi phản hồi và ảnh đã tải trong phiên chat cho yêu cầu hỗ trợ chưa kết thúc, sau khi khách xác nhận nội dung và ảnh.",
  inputSchema: responseSchema,
  roles: ["CUSTOMER"],
  mutates: true,
  requiresConfirmation: true,
  preview: (context, args) => care.previewTicketAction(context.user.id, args.ticketId, args.message, agentRequestAttachments(context.session, args.customerAttachments)),
  execute: (context, args) => care.respond(context.user.id, args.ticketId, args.message, agentRequestAttachments(context.session, args.customerAttachments)),
  reconcile: (context, args) => context.actionCreatedAt
    ? care.reconcileResponse(context.user.id, args.ticketId, args.message, args.customerAttachments ?? [], context.actionCreatedAt) : Promise.resolve(null),
  reply: receipt("Đã gửi phản hồi hỗ trợ."),
};
