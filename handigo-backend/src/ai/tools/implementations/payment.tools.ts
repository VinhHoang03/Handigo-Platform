import { z } from "zod";
import { AgentPaymentService, agentPaymentResultSchema } from "../../../services/agentPayment.service";
import type { AgentTool } from "../tool.interface";
import { idSchema } from "./booking.schemas";

const paymentReply = (result: unknown) => {
  const payment = agentPaymentResultSchema.parse(result);
  return { message: payment.message, state: "WAITING_USER_INPUT" as const, retryable: payment.status === "blocked" };
};
export const createPaymentTool: AgentTool<{ orderId: string; method: "PAYOS" | "WALLET" | "CASH" }> = {
  name: "create_payment", description: "Thanh toán riêng cho đơn đã có cần xác nhận số tiền và phương thức. Khi khách đã chọn rõ phương thức mới cho giao dịch đang chờ, thực hiện đổi ngay, không hỏi hoặc hiển thị form xác nhận riêng. Khi có QR PayOS đang chờ và khách muốn WALLET hoặc CASH, backend kiểm tra điều kiện, hủy và xác minh liên kết cũ rồi thanh toán phương thức mới trên cùng đơn. Không yêu cầu khách tự hủy PayOS, không tạo lại đơn. Tiền mặt đang chờ có thể đổi sang WALLET hoặc PAYOS; backend chuyển giao dịch trong transaction, không giữ khoản tiền mặt song song. PAYOS: chuyển khoản; WALLET: trừ ví; CASH: ghi nhận tiền mặt. Đơn vừa xác nhận đã được backend tự thanh toán, chỉ gọi lại khi khách yêu cầu đổi hoặc thanh toán lại. Số tiền do backend tính. Lịch hẹn phải được chuyên gia xác nhận. Không hỗ trợ thu phần báo giá còn lại.",
  inputSchema: z.object({ orderId: idSchema, method: z.enum(["PAYOS", "WALLET", "CASH"]) }).strict(),
  mutates: true, requiresConfirmation: true, roles: ["CUSTOMER"],
  preview: (context, args) => AgentPaymentService.preview(context.user, args),
  execute: (context, args) => AgentPaymentService.pay(context.user, args, context.confirmedPreview, context.signal),
  reply: paymentReply,
};
export const getPaymentStatusTool: AgentTool<{ orderId: string }> = {
  name: "get_payment_status", description: "Kiểm tra thanh toán đơn của khách và đối soát PayOS qua backend. Lấy lại liên kết đang chờ, kiểm tra sau khi trả tiền/hủy PayOS hoặc khi kết quả chưa rõ. Không tạo giao dịch hay trừ tiền.",
  inputSchema: z.object({ orderId: idSchema }).strict(),
  mutates: false, requiresConfirmation: false, roles: ["CUSTOMER"],
  execute: (context, args) => AgentPaymentService.status(context.user, args.orderId), reply: paymentReply,
};
export const cancelPaymentTool: AgentTool<{ orderId: string; paymentId?: string }> = {
  name: "cancel_payment", description: "Hủy riêng giao dịch QR PayOS đang chờ, giữ đơn theo thời hạn hiện tại. Không hủy đơn, không hoàn tiền, không đổi phương thức và không tự tạo QR mới. Dùng khi khách muốn hủy QR/hủy thanh toán nhưng giữ đơn; cần xác định đúng đơn và xác nhận riêng. paymentId dùng để gắn đúng QR từ giao diện. Đã trả tiền hoặc PayOS đang xử lý phải kiểm tra trạng thái, không báo hủy thành công.",
  inputSchema: z.object({ orderId: idSchema, paymentId: idSchema.optional() }).strict(),
  mutates: true, requiresConfirmation: true, roles: ["CUSTOMER"],
  preview: (context, args) => AgentPaymentService.previewCancellation(context.user, args.orderId, args.paymentId),
  execute: (context, args) => {
    if (!context.actionId) throw new Error("Thiếu hành động xác nhận hủy QR.");
    return AgentPaymentService.cancel(context.user, args.orderId, context.confirmedPreview, context.actionId, context.signal);
  },
  reply: (result) => {
    const payment = agentPaymentResultSchema.parse(result);
    return { state: "WAITING_USER_INPUT", message: payment.message, retryable: ["pending", "blocked"].includes(payment.status) };
  },
};
