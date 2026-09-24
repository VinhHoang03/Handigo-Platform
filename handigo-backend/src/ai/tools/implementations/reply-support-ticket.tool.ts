import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { AgentCustomerCareService as care } from "../../../services/agentCustomerCare.service";
import { responseSchema } from "./customer-care.schemas";
import { receipt } from "./customer-care.reply";

export const replySupportTicketTool: AgentTool<z.infer<typeof responseSchema>> = {
  name: "reply_support_ticket",
  description: "Gửi phản hồi bằng văn bản cho yêu cầu hỗ trợ chưa kết thúc, sau khi khách xác nhận nội dung.",
  inputSchema: responseSchema,
  roles: ["CUSTOMER"],
  mutates: true,
  requiresConfirmation: true,
  preview: (context, args) => care.previewTicketAction(context.user.id, args.ticketId, args.message),
  execute: (context, args) => care.respond(context.user.id, args.ticketId, args.message),
  reply: receipt("Đã gửi phản hồi hỗ trợ."),
};
