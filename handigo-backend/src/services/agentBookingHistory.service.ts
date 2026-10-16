import { z } from "zod";
import { QueryFilter, Types } from "mongoose";
import { Order, type IOrder } from "../models/order.model";
import { Service } from "../models/service.model";
import { Address } from "../models/address.model";
import { Provider } from "../models/provider.model";
import User from "../models/user.model";
import { Payment } from "../models/payment.model";
import { Refund } from "../models/refund.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { AppError } from "../utils/appError";
import { idSchema } from "../ai/tools/implementations/booking.schemas";

const text = z.string().trim().min(1, "Vui lòng nhập tiêu chí tìm kiếm.").max(100, "Tiêu chí tìm kiếm tối đa 100 ký tự.");
export const bookingSearchSchema = z.object({
  search: text.optional(), service: text.optional(), serviceId: idSchema.optional(),
  address: text.optional(), provider: text.optional(), providerId: idSchema.optional(),
  status: z.enum(["created", "accepted", "in_progress", "completed", "cancelled"]).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  dateField: z.enum(["createdAt", "scheduledAt"]).default("createdAt"),
  page: z.number().int().min(1).max(10000).default(1),
  limit: z.number().int().min(1).max(10).default(5),
}).strict().refine((value) => !value.from || !value.to || Date.parse(value.from) <= Date.parse(value.to), {
  message: "Ngày bắt đầu không được sau ngày kết thúc.", path: ["to"],
});
export type BookingSearch = z.infer<typeof bookingSearchSchema>;
const regex = (value: string) => ({ $regex: value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" });

export async function ownedBooking(userId: string, orderId: string) {
  const order = await Order.findOne({ _id: orderId, customerId: userId, isDeleted: false }).lean();
  if (!order) throw new AppError("Không tìm thấy đơn hàng của bạn.", 404);
  return order;
}

export const AgentBookingHistoryService = {
  async search(userId: string, args: BookingSearch, withProvider = false) {
    const conditions: QueryFilter<IOrder>[] = [{ customerId: new Types.ObjectId(userId), isDeleted: false }];
    if (withProvider) conditions.push({ providerId: { $ne: null } });
    if (args.status) conditions.push({ status: args.status });
    if (args.serviceId) conditions.push({ serviceId: args.serviceId });
    if (args.providerId) conditions.push({ providerId: args.providerId });
    if (args.from || args.to) conditions.push({ [args.dateField]: {
      ...(args.from ? { $gte: new Date(args.from) } : {}), ...(args.to ? { $lte: new Date(args.to) } : {}),
    } });
    if (args.service || args.search) {
      const services = await Service.find({ name: regex(args.service ?? args.search!) }).select("_id").lean();
      conditions.push(args.service ? { serviceId: { $in: services.map((item) => item._id) } } : {
        $or: [{ orderCode: regex(args.search!) }, { problemDescription: regex(args.search!) },
          { serviceId: { $in: services.map((item) => item._id) } }],
      });
      if (args.service && args.search) conditions.push({ $or: [
        { orderCode: regex(args.search) }, { problemDescription: regex(args.search) },
      ] });
    }
    if (args.address) {
      const matches = ["fullAddress", "ward", "province", "note", "recipientName"].map((field) => ({ [field]: regex(args.address!) }));
      const addresses = await Address.find({ userId, isDeleted: false, $or: matches }).select("_id").lean();
      conditions.push({ $or: [
        ...["fullAddress", "ward", "province", "recipientName"].map((field) => ({ [`addressSnapshot.${field}`]: regex(args.address!) })),
        { addressId: { $in: addresses.map((item) => item._id) } },
      ] });
    }
    if (args.provider) {
      const users = await User.find({ fullName: regex(args.provider), isDeleted: false }).select("_id").lean();
      const profiles = await Provider.find({ userId: { $in: users.map((item) => item._id) } }).select("_id").lean();
      conditions.push({ providerId: { $in: profiles.map((item) => item._id) } });
    }
    const filter = { $and: conditions };
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1, _id: -1 }).skip((args.page - 1) * args.limit).limit(args.limit)
        .select("orderCode status serviceId addressId addressSnapshot providerId createdAt scheduledAt paymentStatus selectedOptionsSnapshot inspectionRequired currentQuotationId")
        .populate<{ serviceId: { _id: Types.ObjectId; name: string; serviceType?: "fixed_price" | "variable_price" } | null }>("serviceId", "name serviceType")
        .populate<{ addressId: { fullAddress: string; ward: string; province: string } | null }>("addressId", "fullAddress ward province")
        .populate<{ providerId: { _id: Types.ObjectId; userId: { fullName: string } | null } | null }>({ path: "providerId", select: "userId", populate: { path: "userId", select: "fullName" } }).lean(),
      Order.countDocuments(filter),
    ]);
    return { items: orders.map((order) => ({
      orderId: String(order._id), orderCode: order.orderCode, status: order.status,
      serviceId: order.serviceId ? String(order.serviceId._id) : null, service: order.serviceId?.name ?? "Dịch vụ không còn tồn tại",
      serviceType: typeof order.inspectionRequired === "boolean"
        ? order.inspectionRequired ? "variable_price" as const : "fixed_price" as const : order.serviceId?.serviceType ?? null,
      hasQuotation: Boolean(order.currentQuotationId),
      address: order.addressSnapshot ?? (order.addressId ? { fullAddress: order.addressId.fullAddress, ward: order.addressId.ward, province: order.addressId.province } : null),
      providerId: order.providerId ? String(order.providerId._id) : null, provider: order.providerId?.userId?.fullName ?? null,
      createdAt: order.createdAt, scheduledAt: order.scheduledAt, paymentStatus: order.paymentStatus,
      options: order.selectedOptionsSnapshot.slice(0, 6).map((item) => ({ name: item.name, quantity: item.quantity ?? 1 })),
    })), pagination: { page: args.page, limit: args.limit, total, totalPages: Math.ceil(total / args.limit) },
    note: "Thời gian lọc theo trường dateField; ngày giờ Việt Nam cần offset +07:00. Địa chỉ ưu tiên bản lưu tại lúc đặt đơn. Không tự chọn khi có nhiều đơn phù hợp." };
  },
  async previousProviders(userId: string, args: BookingSearch) {
    const result = await this.search(userId, { ...args, status: "completed" }, true);
    return { ...result, items: result.items.filter((item) => item.providerId),
      note: "Danh sách theo từng đơn đã hoàn thành, có thể một thợ xuất hiện nhiều lần. Chọn đúng ID từ lịch sử rồi dùng update_booking_draft để kiểm tra lại dịch vụ, khu vực và lịch hiện tại; chưa xác nhận thợ còn khả dụng." };
  },
  async refunds(userId: string, orderId: string) {
    const order = await ownedBooking(userId, orderId);
    const [refunds, transactions, payments] = await Promise.all([
      Refund.find({ orderId, customerId: userId, isDeleted: false }).sort({ createdAt: -1 }).lean(),
      WalletTransaction.find({ relatedOrderId: orderId, userId, type: "refund", direction: "in", isDeleted: false }).sort({ createdAt: -1 }).lean(),
      Payment.find({ orderId, customerId: userId, isDeleted: false }).select("amount method status refundedAt metadata.refund").lean(),
    ]);
    return { orderId, orderCode: order.orderCode, status: order.status, paymentStatus: order.paymentStatus,
      policy: order.cancellation?.refundPolicy ? {
        paidAmount: order.cancellation.refundPolicy.paidAmount, refundAmount: order.cancellation.refundPolicy.refundAmount,
        cancellationFee: order.cancellation.refundPolicy.cancellationFee, reason: order.cancellation.refundPolicy.policyReason,
      } : null,
      refunds: refunds.map((refund) => ({ id: String(refund._id), paymentId: String(refund.paymentId), amount: refund.amount,
        status: refund.status, destination: refund.destination ?? (refund.channel === "handigo_wallet" ? "handigo_wallet" : refund.channel === "payos_payout" ? "source_account" : null),
        channel: refund.channel ?? null, createdAt: refund.createdAt, completedAt: refund.completedAt ?? null })),
      walletTransactions: transactions.map((item) => ({ id: String(item._id), paymentId: item.relatedPaymentId ? String(item.relatedPaymentId) : null,
        transactionCode: item.transactionCode, amount: item.amount, status: item.status, createdAt: item.createdAt, destination: "handigo_wallet" })),
      payments: payments.map((item) => ({ paymentId: String(item._id), amount: item.amount, method: item.method,
        status: item.status, refundedAt: item.refundedAt ?? null,
        legacyRefund: (() => {
          const value = z.object({ amount: z.number().nonnegative().optional(),
            status: z.string().max(50).optional(), channel: z.enum(["payos_payout", "handigo_wallet"]).optional(),
            destination: z.enum(["source_account", "handigo_wallet"]).optional(), completedAt: z.union([z.string(), z.date()]).optional(),
          }).safeParse(item.metadata?.refund);
          return value.success ? value.data : null;
        })(),
      })),
      note: "Khoản hoàn và giao dịch ví có thể là cùng một lần hoàn, không cộng hai lần. Chỉ giao dịch ví success hoặc khoản hoàn succeeded chứng minh đã hoàn; không suy ra từ trạng thái đơn. Không có dữ liệu đích nhận thì nói chưa xác định. Chưa có khoản hoàn không có nghĩa tiền bị mất; đối chiếu chính sách và liên hệ hỗ trợ khi cần." };
  },
};
