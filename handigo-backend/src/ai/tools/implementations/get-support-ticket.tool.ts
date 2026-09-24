import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { AgentCustomerCareService as care } from "../../../services/agentCustomerCare.service";
import { ticketDetailSchema } from "./customer-care.schemas";

export const getSupportTicketTool: AgentTool<z.infer<typeof ticketDetailSchema>> = {
  name: "get_support_ticket",
  description: "Xem nội dung, trạng thái, kết quả và phản hồi của yêu cầu hỗ trợ thuộc khách. responsePage=1 là hai phản hồi mới nhất; tăng trang để đọc phản hồi cũ.",
  inputSchema: ticketDetailSchema,
  roles: ["CUSTOMER"],
  mutates: false,
  requiresConfirmation: false,
  execute: (context, args) => care.ticket(context.user.id, args.ticketId, args.responsePage),
};
