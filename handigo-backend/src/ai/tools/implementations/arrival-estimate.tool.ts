import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { idSchema } from "./booking.schemas";
import { getAgentArrivalEstimate } from "../../../services/agentArrivalEstimate.service";

const schema = z.object({ orderId: idSchema }).strict();
export const getBookingArrivalEstimateTool: AgentTool<z.infer<typeof schema>> = {
  name: "get_booking_arrival_estimate", description: "Ước tính khoảng cách và thời gian di chuyển của thợ cho đúng đơn khách, dùng GPS mới tối đa 60 giây và dịch vụ tuyến đường của bản đồ. Kết quả tại thời điểm kiểm tra; mở map để xem cập nhật liên tục. Không suy ETA từ khoảng cách đường thẳng hoặc GPS cũ.",
  inputSchema: schema, roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
  execute: (ctx, args) => getAgentArrivalEstimate(ctx.user.id, args.orderId, ctx.signal),
  reply: (result) => {
    const data = result as { message: string; path: string };
    return { state: "WAITING_USER_INPUT", message: `${data.message}\n[Xem đơn và theo dõi thợ](${data.path})` };
  },
};
