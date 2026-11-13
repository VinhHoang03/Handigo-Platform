import QRCode from "qrcode";
import { Payment } from "../models/payment.model";
import { Order } from "../models/order.model";
import type { RequestUser } from "../middlewares/authContext";
import { AppError } from "../utils/appError";
import { WalletTransaction } from "../models/walletTransaction.model";

function renderPayosQr(link: { qrCode?: unknown } | undefined) {
  if (typeof link?.qrCode !== "string" || !link.qrCode.trim() || link.qrCode.length > 2048) {
    throw new AppError("Giao dịch chưa có dữ liệu QR từ PayOS. Vui lòng kiểm tra thanh toán.", 409);
  }
  // Mã hóa nguyên chuỗi PayOS đã lưu; không tạo QR từ link checkout hoặc dữ liệu của client.
  return QRCode.toBuffer(link.qrCode, { type: "png", width: 360, margin: 4, errorCorrectionLevel: "M" });
}

export async function getPayosWalletDepositQr(orderCode: string, user: RequestUser) {
  if (!["CUSTOMER", "PROVIDER"].includes(user.role)) throw new AppError("Bạn không có quyền xem mã QR nạp ví.", 403);
  const transaction = await WalletTransaction.findOne({
    userId: user.id, gatewayOrderCode: orderCode, type: "deposit", isDeleted: false,
  }).lean();
  if (!transaction) throw new AppError("Không tìm thấy giao dịch nạp ví của bạn.", 404);
  if (transaction.status !== "pending") throw new AppError("Giao dịch không còn chờ nạp ví.", 409);
  return renderPayosQr(transaction.gatewayResponse?.paymentLink as { qrCode?: unknown } | undefined);
}

export async function getPayosPaymentQr(paymentId: string, user: RequestUser) {
  if (user.role !== "CUSTOMER") throw new AppError("Mã QR thanh toán chỉ dành cho khách hàng của đơn.", 403);
  const payment = await Payment.findOne({ _id: paymentId, customerId: user.id, isDeleted: false }).lean();
  if (!payment) throw new AppError("Không tìm thấy giao dịch thanh toán của bạn.", 404);
  const order = await Order.findOne({ _id: payment.orderId, customerId: user.id, isDeleted: false }).select("status").lean();
  if (!order) throw new AppError("Không tìm thấy đơn hàng của bạn.", 404);
  if (payment.method !== "payos" || payment.status !== "pending" || order.status === "cancelled"
    || (order.status === "completed" && payment.paymentType !== "remaining")) {
    throw new AppError("Giao dịch không còn cho phép thanh toán bằng mã QR PayOS.", 409);
  }
  const link = payment.gatewayResponse?.paymentLink as { qrCode?: unknown } | undefined;
  return renderPayosQr(link);
}
