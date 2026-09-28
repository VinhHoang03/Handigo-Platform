import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { AgentCustomerCareService as care, agentComplaintSchema } from "../../../services/agentCustomerCare.service";
import { receipt } from "./customer-care.reply";

export const createComplaintTool: AgentTool<z.infer<typeof agentComplaintSchema>> = {
  name: "create_complaint",
  description: "Khiếu nại chất lượng dịch vụ của đơn đã hoàn thành trong 3 ngày, chưa có khiếu nại của khách. Cần orderId, tiêu đề và mô tả. Kiểm tra điều kiện và xác nhận trước khi gửi; không tự quyết định hoàn tiền.",
  inputSchema: agentComplaintSchema,
  roles: ["CUSTOMER"],
  mutates: true,
  requiresConfirmation: true,
  preview: (context, args) => care.previewComplaint(context.user.id, args),
  execute: (context, args) => care.createComplaint(context.user.id, args),
  reply: receipt("Đã gửi khiếu nại, đang chờ xem xét. Đây chưa phải quyết định hoàn tiền."),
};
