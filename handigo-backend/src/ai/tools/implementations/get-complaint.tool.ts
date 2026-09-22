import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { AgentCustomerCareService as care } from "../../../services/agentCustomerCare.service";
import { complaintIdSchema } from "./customer-care.schemas";

export const getComplaintTool: AgentTool<z.infer<typeof complaintIdSchema>> = {
  name: "get_complaint",
  description: "Xem trạng thái, nội dung, yêu cầu bổ sung bằng chứng và kết quả xử lý khiếu nại thuộc khách.",
  inputSchema: complaintIdSchema,
  roles: ["CUSTOMER"],
  mutates: false,
  requiresConfirmation: false,
  execute: (context, args) => care.complaint(context.user.id, args.complaintId),
};
