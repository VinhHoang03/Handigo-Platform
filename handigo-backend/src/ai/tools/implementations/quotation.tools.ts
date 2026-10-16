import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { idSchema } from "./booking.schemas";
import { AgentQuotationService } from "../../../services/agentQuotation.service";
import { quotationReply } from "../../agent/booking-read-results";

const orderSchema = z.object({ orderId: idSchema }).strict();
export const getBookingQuotationTool: AgentTool<z.infer<typeof orderSchema>> = {
  name: "get_booking_quotation", inputSchema: orderSchema,
  roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
  description: "Đọc báo giá hiện tại trên đơn của khách: từng hạng mục, số lượng, đơn giá, giảm giá, tổng báo giá, cọc thực trả và tiền còn trả trực tiếp. Chưa có báo giá trả quotation null. Không thu phần sửa chữa qua Handigo; không tự xác nhận đã trả tiền. canRequestRejection là khả năng sơ bộ, cần preview để kiểm tra chính sách hủy.",
  execute: (context, args) => AgentQuotationService.get(context.user.id, args.orderId),
  reply: (result) => ({ state: "WAITING_USER_INPUT", message: quotationReply(result as Awaited<ReturnType<typeof AgentQuotationService.get>>) }),
};
const rejectionSchema = orderSchema.extend({ reason: z.string().trim().min(3).max(500) });
export const rejectBookingQuotationTool: AgentTool<z.infer<typeof rejectionSchema>> = {
  name: "reject_booking_quotation", inputSchema: rejectionSchema,
  roles: ["CUSTOMER"], mutates: true, requiresConfirmation: true,
  description: "Khách yêu cầu từ chối báo giá pending: chuẩn bị bản xác nhận từ chối VÀ hủy đơn, kèm phí và tiền hoàn theo chính sách hiện có. Không thực hiện cho saved/approved hoặc đơn đang thực hiện. Chỉ thực hiện khi khách bấm xác nhận; thay đổi phiên bản báo giá hoặc số tiền phải xác nhận lại. Không gọi nếu khách chỉ hỏi ý nghĩa báo giá.",
  preview: (context, args) => AgentQuotationService.previewReject(context.user.id, args.orderId, args.reason),
  execute: (context, args) => AgentQuotationService.reject(context.user.id, args.orderId, args.reason, context.confirmedPreview),
  reply: (result) => ({ state: "COMPLETED", message: (result as { message: string }).message }),
};
