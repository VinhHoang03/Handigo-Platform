import { z } from "zod";
import { AgentPaymentService, agentPaymentResultSchema } from "../../../services/agentPayment.service";
import type { AgentTool } from "../tool.interface";
import { idSchema } from "./booking.schemas";

const paymentReply = (result: unknown) => {
  const payment = agentPaymentResultSchema.parse(result);
  return { message: payment.message, state: "WAITING_USER_INPUT" as const, retryable: payment.status === "blocked" };
};
export const createPaymentTool: AgentTool<{ orderId: string; method: "PAYOS" | "WALLET" | "CASH" }> = {
  name: "create_payment", description: "Thanh toán đơn đã tạo. PAYOS: chuyển khoản; WALLET: trừ ví; CASH: ghi nhận tiền mặt. Luôn cần xác nhận riêng. Số tiền do backend tính. Lịch hẹn phải được chuyên gia xác nhận. Không hỗ trợ thu phần báo giá còn lại.",
  inputSchema: z.object({ orderId: idSchema, method: z.enum(["PAYOS", "WALLET", "CASH"]) }).strict(),
  mutates: true, requiresConfirmation: true, roles: ["CUSTOMER"],
  preview: (context, args) => AgentPaymentService.preview(context.user, args),
  execute: (context, args) => AgentPaymentService.pay(context.user, args, context.confirmedPreview),
  reply: paymentReply,
};
export const getPaymentStatusTool: AgentTool<{ orderId: string }> = {
  name: "get_payment_status", description: "Kiểm tra thanh toán đơn của khách và đối soát PayOS qua backend. Lấy lại liên kết đang chờ, kiểm tra sau khi trả tiền/hủy PayOS hoặc khi kết quả chưa rõ. Không tạo giao dịch hay trừ tiền.",
  inputSchema: z.object({ orderId: idSchema }).strict(),
  mutates: false, requiresConfirmation: false, roles: ["CUSTOMER"],
  execute: (context, args) => AgentPaymentService.status(context.user, args.orderId), reply: paymentReply,
};
