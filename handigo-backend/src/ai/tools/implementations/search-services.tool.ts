import { z } from "zod";
import { AgentBookingService } from "../../../services/agentBooking.service";
import type { AgentTool } from "../tool.interface";
export const searchServicesTool: AgentTool<{ query: string }> = {
  name: "search_services", description: "Tìm dịch vụ đang hoạt động theo tên.",
  inputSchema: z.object({ query: z.string().trim().min(1).max(100) }).strict(),
  mutates: false, requiresConfirmation: false, roles: ["CUSTOMER"],
  execute: (_context, args) => AgentBookingService.search(args.query),
};
