import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { idSchema } from "./booking.schemas";
import { AgentAssignedProviderService } from "../../../services/agentAssignedProvider.service";

const schema = z.object({ orderId: idSchema }).strict();
export const getBookingProviderTool: AgentTool<z.infer<typeof schema>> = {
  name: "get_booking_provider", description: "Tra thợ thực tế đang được phân công cho đúng đơn của khách, thông tin liên hệ và vị trí chia sẻ gần nhất. Không dùng thợ ưu tiên thay cho thợ thực hiện; không suy đoán thời gian đến. Web hiển thị thẻ liên hệ, chat, theo dõi và làm mới.",
  inputSchema: schema, mutates: false, requiresConfirmation: false, roles: ["CUSTOMER"],
  execute: (context, args) => AgentAssignedProviderService.get(context.user.id, args.orderId),
  reply: (result) => ({ state: "WAITING_USER_INPUT", message: (result as { message: string }).message }),
};
