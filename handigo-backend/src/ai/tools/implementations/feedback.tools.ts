import { z } from "zod";
import type { AgentTool, ToolContext } from "../tool.interface";
import { idSchema } from "./booking.schemas";
import { agentRequestAttachments } from "../../agent/booking-attachments";
import { AgentFeedbackService, agentFeedbackSchema } from "../../../services/agentFeedback.service";

const orderSchema = z.object({ orderId: idSchema }).strict();
const feedbackAttachments = (context: ToolContext, args: z.infer<typeof agentFeedbackSchema>) => {
  const latest = context.session?.conversation.slice().reverse().find((message) => message.role === "user");
  return args.customerAttachments !== undefined || latest?.customerAttachments !== undefined
    ? agentRequestAttachments(context.session, args.customerAttachments) : undefined;
};
export const getBookingFeedbackTool: AgentTool<z.infer<typeof orderSchema>> = {
  name: "get_booking_feedback", description: "Kiểm tra điều kiện và đánh giá hiện tại của đúng đơn thuộc khách, trước khi tạo hoặc sửa đánh giá. Chỉ đơn hoàn thành có thợ thực hiện mới được đánh giá.",
  inputSchema: orderSchema, mutates: false, requiresConfirmation: false, roles: ["CUSTOMER"],
  execute: (context, args) => AgentFeedbackService.get(context.user.id, args.orderId),
};
export const submitBookingFeedbackTool: AgentTool<z.infer<typeof agentFeedbackSchema>> = {
  name: "submit_booking_feedback", description: "Tạo đánh giá hoặc sửa đánh giá khi khách yêu cầu rõ. rating phải là số sao khách chọn (1–5), không suy đoán. mode update chỉ khi khách yêu cầu sửa đánh giá cũ; create không ghi đè đánh giá đã có. Có thể đính kèm ảnh đã tải trong chat. Luôn xác nhận trước khi gửi.",
  inputSchema: agentFeedbackSchema, mutates: true, requiresConfirmation: true, roles: ["CUSTOMER"],
  preview: (context, args) => AgentFeedbackService.preview(context.user.id, { ...args, customerAttachments: feedbackAttachments(context, args) }),
  execute: (context, args) => AgentFeedbackService.submit(context.user.id, { ...args, customerAttachments: feedbackAttachments(context, args) }, context.confirmedPreview),
  reply: (result) => ({ state: "COMPLETED", message: (result as { message: string }).message }),
};
