import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { OrderService } from "../../../services/order.service";
import { idSchema } from "./booking.schemas";

const inputSchema = z.object({ orderId: idSchema }).strict();

export const getCancellationPreviewTool: AgentTool<z.infer<typeof inputSchema>> = {
  name: "get_cancellation_preview",
  description: "Chỉ đọc điều kiện hủy, phí hủy và tiền hoàn dự kiến cho một đơn của khách. Không hủy đơn và không cần xác nhận. Dùng khi khách chỉ hỏi chính sách áp dụng cho đơn cụ thể.",
  inputSchema,
  roles: ["CUSTOMER"],
  mutates: false,
  requiresConfirmation: false,
  execute: async (context, args) => {
    const result = await OrderService.previewCancellation(args.orderId, context.user.id, "customer");
    const item = result.items[0];
    return { orderId: args.orderId, orderCode: item?.orderCode, canCancel: result.canCancel,
      paidAmount: result.paidAmount, refundAmount: result.refundAmount, cancellationFee: result.cancellationFee,
      refundRate: item?.refundRate, policyReason: item?.policyReason, policyVersion: result.policyVersion,
      note: "Chỉ là bản xem trước tại thời điểm kiểm tra, chưa hủy đơn hoặc thực hiện hoàn tiền." };
  },
};
