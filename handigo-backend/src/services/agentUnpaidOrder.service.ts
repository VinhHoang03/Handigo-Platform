import { z } from "zod";
import { Order } from "../models/order.model";
import { OrderService } from "./order.service";
import { AppError } from "../utils/appError";
import { ActionPreconditionError } from "../utils/actionPreconditionError";

const expectedSchema = z.object({ orderId: z.string(), orderVersion: z.string().datetime() });
const result = (orderId: string) => ({ orderId, message: "Đã xóa đơn chưa thanh toán. Không phải hủy một đơn đã được thanh toán hoặc đang tìm thợ." });

export const AgentUnpaidOrderService = {
  async preview(userId: string, orderId: string) {
    const order = await Order.findOne({ _id: orderId, customerId: userId, isDeleted: false }).lean();
    if (!order) throw new AppError("Không tìm thấy đơn hàng của bạn.", 404);
    if (order.status !== "created" || order.paymentStatus !== "unpaid" || order.readyForMatching) {
      throw new AppError("Chỉ xóa đơn vừa tạo chưa thanh toán và chưa đưa vào tìm thợ. Với đơn khác, hãy kiểm tra điều kiện hủy đơn.", 409);
    }
    return { title: "Xóa đơn chưa thanh toán", orderId, orderCode: order.orderCode, orderVersion: order.updatedAt.toISOString(),
      note: "Xác nhận sẽ xóa đơn này và kiểm tra, đóng QR đang chờ nếu có. Nếu PayOS đã nhận tiền hoặc chưa đối soát được, hệ thống không xóa đơn. Thao tác không thể hoàn tác." };
  },
  async discard(userId: string, orderId: string, expected: unknown) {
    const preview = expectedSchema.parse(expected);
    if (preview.orderId !== orderId) throw new ActionPreconditionError();
    try { await OrderService.discardUnpaidOrder(orderId, userId, preview.orderVersion); }
    catch (error) {
      if (error instanceof AppError && error.statusCode < 500) throw new ActionPreconditionError(error.message);
      throw error;
    }
    return result(orderId);
  },
  async reconcile(userId: string, orderId: string, startedAt?: string) {
    if (!Number.isFinite(Date.parse(startedAt ?? ""))) return null;
    const order = await Order.findOne({ _id: orderId, customerId: userId, isDeleted: true, status: "created", paymentStatus: "unpaid" }).lean();
    return order?.deletedAt && order.deletedAt.getTime() >= Date.parse(startedAt!) ? result(orderId) : null;
  },
};
