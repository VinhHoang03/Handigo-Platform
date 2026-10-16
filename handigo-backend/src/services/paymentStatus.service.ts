import type { IPayment } from "../models/payment.model";
import { emitToUser } from "../sockets/socketServer";
import { createLogger } from "../utils/logger";

const logger = createLogger("PaymentStatus");

// Chỉ gọi sau khi transaction đã commit; socket là tín hiệu để client đọc lại dữ liệu backend.
export function publishPaymentStatus(payment: Pick<IPayment, "_id" | "orderId" | "customerId" | "method" | "status">) {
  if (payment.method !== "payos" || payment.status === "pending") return;
  try {
    emitToUser(String(payment.customerId), "payment:status", {
      paymentId: String(payment._id), orderId: String(payment.orderId), status: payment.status,
    });
  } catch {
    logger.warn("Thanh toán đã xác minh; chưa gửi được tín hiệu cập nhật tức thời.", { paymentId: String(payment._id) });
  }
}
