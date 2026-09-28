import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { AgentCustomerCareService as care } from "../../../services/agentCustomerCare.service";
import { complaintIdSchema } from "./customer-care.schemas";
import { receipt } from "./customer-care.reply";

export const cancelComplaintTool: AgentTool<z.infer<typeof complaintIdSchema>> = {
  name: "cancel_complaint",
  description: "Hủy khiếu nại chưa kết thúc khi khách yêu cầu rõ và xác nhận; không thể tạo lại khiếu nại cho cùng đơn. Không hủy đơn dịch vụ.",
  inputSchema: complaintIdSchema,
  roles: ["CUSTOMER"],
  mutates: true,
  requiresConfirmation: true,
  preview: (context, args) => care.previewCancelComplaint(context.user.id, args.complaintId),
  execute: (context, args) => care.cancelComplaint(context.user.id, args.complaintId),
  reply: receipt("Đã hủy khiếu nại."),
};
