import type { z } from "zod";
import { AgentBookingService } from "../../../services/agentBooking.service";
import type { AgentTool } from "../tool.interface";
import { availabilitySchema } from "./booking.schemas";
export const getAvailableTimesTool: AgentTool<z.infer<typeof availabilitySchema>> = {
  name: "get_available_times", description: "Kiểm tra tối đa 8 giờ dự kiến tại địa chỉ đã lưu của khách. Không giữ chỗ.",
  inputSchema: availabilitySchema, mutates: false, requiresConfirmation: false, roles: ["CUSTOMER"],
  execute: (context, args) => AgentBookingService.availableTimes(context.user.id, args),
};
