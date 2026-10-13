import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { idSchema } from "./booking.schemas";
import { AgentOrderProviderService } from "../../../services/agentOrderProvider.service";

const orderSchema = z.object({ orderId: idSchema }).strict();
const selectionSchema = orderSchema.extend({ providerId: idSchema });
const responseSchema = orderSchema.extend({ decision: z.enum(["accept", "decline"]) });
export const getOrderProviderOptionsTool: AgentTool<z.infer<typeof orderSchema>> = {
  name: "get_order_provider_options", roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
  description: "Đọc yêu cầu đổi thợ và danh sách thợ trực tuyến phù hợp cho đơn đã tạo sau từ chối hoặc yêu cầu người thay thế. Loại thợ đã từ chối/không phản hồi/rời đơn, kiểm tra khu vực, dịch vụ và toàn bộ lịch. Không dùng search_booking_providers cho đơn đã tạo. canRespond cho biết có thể đồng ý hệ thống tìm hoặc từ chối; canChoose cho biết có thể chọn đích danh. Chưa gửi yêu cầu mới.",
  inputSchema: orderSchema,
  execute: (context, args) => AgentOrderProviderService.options(context.user.id, args.orderId),
};
export const selectOrderProviderTool: AgentTool<z.infer<typeof selectionSchema>> = {
  name: "select_order_provider", roles: ["CUSTOMER"], mutates: true, requiresConfirmation: true,
  description: "Sau khách chọn ID thật từ get_order_provider_options, chuẩn bị xác nhận chọn thợ thay thế trên cùng đơn. Gửi yêu cầu nhận đơn sau xác nhận, chưa bảo đảm thợ nhận. Không tạo lại đơn/thanh toán. Nếu khách chỉ đồng ý tìm thợ mà chưa chọn người, đọc lựa chọn hoặc dùng respond_provider_reassignment accept khi khách muốn hệ thống tự tìm.",
  inputSchema: selectionSchema,
  preview: (context, args) => AgentOrderProviderService.previewSelect(context.user.id, args.orderId, args.providerId),
  execute: (context, args) => AgentOrderProviderService.select(context.user.id, args.orderId, args.providerId, context.confirmedPreview),
};
export const respondProviderReassignmentTool: AgentTool<z.infer<typeof responseSchema>> = {
  name: "respond_provider_reassignment", roles: ["CUSTOMER"], mutates: true, requiresConfirmation: true,
  description: "Phản hồi yêu cầu đổi thợ đang chờ trên đơn của khách. accept: đồng ý để hệ thống tự tìm người thay thế. decline: từ chối tìm người thay thế và hủy đơn, phải xác nhận phí hủy/hoàn tiền trong preview. Không hiểu việc khách từ chối một thợ cụ thể là decline. Nếu khách chọn đích danh thì dùng select_order_provider thay vì accept trước để tránh hệ thống tự phân công người khác.",
  inputSchema: responseSchema,
  preview: (context, args) => AgentOrderProviderService.previewResponse(context.user.id, args.orderId, args.decision),
  execute: (context, args) => AgentOrderProviderService.respond(context.user.id, args.orderId, args.decision, context.confirmedPreview),
};
