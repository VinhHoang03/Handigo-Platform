import QRCode from "qrcode";
import { Payment } from "../models/payment.model";
import { Order } from "../models/order.model";
import type { RequestUser } from "../middlewares/authContext";
import { AppError } from "../utils/appError";

export async function getPayosPaymentQr(paymentId: string, user: RequestUser) {
  if (user.role !== "CUSTOMER") throw new AppError("Mã QR thanh toán chỉ dành cho khách hàng của đơn.", 403);
  const payment = await Payment.findOne({ _id: paymentId, customerId: user.id, isDeleted: false }).lean();
  if (!payment) throw new AppError("Không tìm thấy giao dịch thanh toán của bạn.", 404);
  const order = await Order.findOne({ _id: payment.orderId, customerId: user.id, isDeleted: false }).select("status").lean();
  if (!order) throw new AppError("Không tìm thấy đơn hàng của bạn.", 404);
  if (payment.method !== "payos" || payment.status !== "pending" || ["cancelled", "completed"].includes(order.status)) {
    throw new AppError("Giao dịch không còn cho phép thanh toán bằng mã QR PayOS.", 409);
  }
  const link = payment.gatewayResponse?.paymentLink as { qrCode?: unknown } | undefined;
  if (typeof link?.qrCode !== "string" || !link.qrCode.trim() || link.qrCode.length > 2048) {
    throw new AppError("Giao dịch chưa có dữ liệu QR từ PayOS. Vui lòng kiểm tra thanh toán.", 409);
  }
  // Mã hóa nguyên chuỗi PayOS đã lưu; không tạo QR từ link checkout hoặc dữ liệu của client.
  return QRCode.toBuffer(link.qrCode, { type: "png", width: 360, margin: 4, errorCorrectionLevel: "M" });
}
