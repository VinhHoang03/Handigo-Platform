import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { AgentCustomerCareService as care } from "../../../services/agentCustomerCare.service";
import { complaintQuerySchema } from "./customer-care.schemas";

export const getMyComplaintsTool: AgentTool<z.infer<typeof complaintQuerySchema>> = {
  name: "get_my_complaints",
  description: "Liệt kê khiếu nại của chính khách, 10 mục mỗi trang; có thể lọc trạng thái hoặc orderId. Dùng để lấy ID trước khi xem hoặc hủy.",
  inputSchema: complaintQuerySchema,
  roles: ["CUSTOMER"],
  mutates: false,
  requiresConfirmation: false,
  execute: (context, args) => care.listComplaints(context.user.id, { ...args, limit: 10 }),
};
