import { z } from "zod";
import { AgentBookingService } from "../../../services/agentBooking.service";
import type { AgentTool } from "../tool.interface";
import { idSchema } from "./booking.schemas";
export const getServiceTool: AgentTool<{ serviceId: string }> = {
  name: "get_service", description: "Lấy dịch vụ và các tùy chọn để hỏi khách chọn đúng loại, số lượng.",
  inputSchema: z.object({ serviceId: idSchema }).strict(),
  mutates: false, requiresConfirmation: false, roles: ["CUSTOMER"],
  execute: (_context, args) => AgentBookingService.service(args.serviceId),
};
