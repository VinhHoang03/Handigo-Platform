import { z } from "zod";
import type { AgentTool, ToolContext } from "../tool.interface";
import { idSchema } from "./booking.schemas";
import { agentRequestAttachments } from "../../agent/booking-attachments";
import { AgentFeedbackService, agentFeedbackSchema } from "../../../services/agentFeedback.service";

const orderSchema = z.object({ orderId: idSchema }).strict();
const moderationSchema = orderSchema.extend({ page: z.number().int().min(1).max(100000).default(1) });
export const getFeedbackModerationTool: AgentTool<z.infer<typeof moderationSchema>> = {
  name: "get_feedback_moderation", description: "Tra trạng thái kiểm duyệt nhận xét của chính khách trên đúng đơn: đang chờ, bị từ chối, đã được duyệt và có đang hiển thị không. Phân biệt bản hiện tại với lịch sử, có phân trang. Không đọc người kiểm duyệt hoặc ghi chú nội bộ, không duyệt hay đăng lại nội dung.",
  inputSchema: moderationSchema, mutates: false, requiresConfirmation: false, roles: ["CUSTOMER"],
  execute: (ctx, args) => AgentFeedbackService.moderation(ctx.user.id, args.orderId, args.page),
};
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
  execute: (context, args) => AgentFeedbackService.submit(context.user.id, { ...args, customerAttachments: feedbackAttachments(context, args) }, context.confirmedPreview, context.sessionId, context.actionId),
  reconcile: (context, args) => context.actionId && context.actionCreatedAt
    ? AgentFeedbackService.reconcile(context.user.id, args, context.confirmedPreview, context.sessionId, context.actionId, context.actionCreatedAt) : Promise.resolve(null),
  reply: (result) => ({ state: "COMPLETED", message: (result as { message: string }).message }),
};
