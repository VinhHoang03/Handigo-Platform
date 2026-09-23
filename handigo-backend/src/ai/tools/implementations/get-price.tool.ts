import type { z } from "zod";
import { AgentBookingService } from "../../../services/agentBooking.service";
import type { AgentTool } from "../tool.interface";
import { priceSchema } from "./booking.schemas";
export const getPriceTool: AgentTool<z.infer<typeof priceSchema>> = {
  name: "get_price", description: "Tính giá thực tế theo dịch vụ, tùy chọn và số lượng. Giá linh hoạt chỉ là tiền cọc.",
  inputSchema: priceSchema, mutates: false, requiresConfirmation: false, roles: ["CUSTOMER"],
  execute: (_context, args) => AgentBookingService.price(args),
};
