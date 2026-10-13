import { isDeepStrictEqual } from "node:util";
import { Types } from "mongoose";
import { Order } from "../models/order.model";
import { Address } from "../models/address.model";
import { OrderAssignment } from "../models/orderAssignment.model";
import User from "../models/user.model";
import { MatchingService } from "./matching.service";
import { OrderService } from "./order.service";
import { getBookingPolicy } from "./systemConfig.service";
import { getOrderInterval } from "./providerSchedule.service";
import { respondToProviderReassignment } from "./orderReassignment.service";
import { AppError } from "../utils/appError";
import { ActionPreconditionError } from "../utils/actionPreconditionError";

export const AgentOrderProviderService = {
  async options(userId: string, orderId: string) {
    const order = await Order.findOne({ _id: orderId, customerId: userId, isDeleted: false });
    if (!order) throw new AppError("Không tìm thấy đơn hàng của bạn.", 404);
    const awaitingResponse = order.reassignment?.status === "awaiting_customer";
    const expired = awaitingResponse && order.reassignment!.expiresAt <= new Date();
    const canChoose = order.status === "created" && !order.providerId && !expired
      && (order.bookingStatus === "rejected" || awaitingResponse);
    const base = { orderId, orderCode: order.orderCode, orderVersion: order.updatedAt.toISOString(),
      canChoose, canRespond: canChoose && awaitingResponse, reason: order.reassignment?.reason,
      responseDeadline: awaitingResponse ? order.reassignment!.expiresAt.toISOString() : undefined };
    if (!canChoose) return { ...base, available: [], note: expired
      ? "Yêu cầu đổi thợ đã hết hạn. Hãy kiểm tra trạng thái đơn và hoàn tiền."
      : "Đơn không còn ở trạng thái chọn lại thợ. Hãy kiểm tra trạng thái hiện tại." };
    const address = await Address.findOne({ _id: order.addressId, userId });
    if (!address) throw new AppError("Không tìm thấy địa chỉ thực hiện của đơn.", 404);
    const related = order.recurringGroupId ? await Order.find({ recurringGroupId: order.recurringGroupId,
      customerId: userId, isDeleted: false }) : [order];
    const declined = await OrderAssignment.find({ orderId: { $in: related.map((item) => item._id) },
      status: { $in: ["rejected", "timeout", "cancelled"] }, isDeleted: false }).select("providerId").lean();
    const excludeProviderIds = [...new Set([...declined.map((item) => String(item.providerId)),
      ...(order.reassignment?.previousProviderIds || []).map(String)])].map((id) => new Types.ObjectId(id));
    const policy = await getBookingPolicy();
    const scheduleIntervals = related.filter((item) => item.status === "created").map((item) => {
      const interval = getOrderInterval(item, policy);
      if (item.scheduledAt) return interval;
      const start = Date.now() + interval.travelMinutes * 60000;
      return { ...interval, start, end: start + interval.end - interval.start };
    });
    const candidates = await MatchingService.findNearestProviders({ serviceId: String(order.serviceId),
      latitude: address.latitude, longitude: address.longitude, province: address.province, ward: address.ward,
      excludeProviderIds, scheduleIntervals, requireOnline: true, limit: 10 });
    const users = await User.find({ _id: { $in: candidates.map((item) => item.userId) }, isDeleted: false }).select("fullName").lean();
    return { ...base, available: candidates.map((item) => ({ id: String(item.providerId),
      name: users.find((user) => String(user._id) === String(item.userId))?.fullName || "Chuyên gia",
      distanceMeters: item.distanceMeters >= 0 ? item.distanceMeters : undefined, averageRating: item.averageRating })),
      note: "Chỉ gửi yêu cầu cho thợ mới sau khi khách chọn và xác nhận. Chưa giữ lịch; thợ vẫn cần đồng ý nhận đơn." };
  },
  async previewSelect(userId: string, orderId: string, providerId: string) {
    const options = await this.options(userId, orderId);
    const provider = options.available.find((item) => item.id === providerId);
    if (!options.canChoose || !provider) throw new ActionPreconditionError("Thợ không còn phù hợp hoặc yêu cầu đã thay đổi. Vui lòng chọn lại.");
    return { title: "Xác nhận chọn thợ thay thế", orderId, orderCode: options.orderCode,
      providerId, providerName: provider.name, orderVersion: options.orderVersion,
      responseDeadline: options.responseDeadline,
      note: "Gửi yêu cầu cho thợ đã chọn trên cùng đơn; giữ dịch vụ, địa chỉ, voucher và thanh toán. Thợ cần xác nhận nhận đơn, chưa phải đã giữ lịch." };
  },
  async select(userId: string, orderId: string, providerId: string, confirmed: unknown) {
    const preview = await this.previewSelect(userId, orderId, providerId);
    if (!isDeepStrictEqual(JSON.parse(JSON.stringify(preview)), confirmed)) throw new ActionPreconditionError();
    const order = await OrderService.selectAppointmentProvider(orderId, userId, providerId, preview.orderVersion);
    return { orderId, orderCode: order.orderCode, bookingStatus: order.bookingStatus,
      message: "Đã gửi yêu cầu cho thợ mới. Mình sẽ tiếp tục cập nhật khi thợ phản hồi; chưa tạo đơn hoặc thanh toán thêm." };
  },
  async previewResponse(userId: string, orderId: string, decision: "accept" | "decline") {
    const options = await this.options(userId, orderId);
    if (!options.canRespond) throw new ActionPreconditionError("Yêu cầu đổi thợ không còn chờ bạn phản hồi.");
    const cancellation = decision === "decline" ? await OrderService.previewCancellation(orderId, userId, "customer") : undefined;
    if (cancellation && !cancellation.canCancel) throw new ActionPreconditionError("Đơn không còn đủ điều kiện hủy.");
    return { title: decision === "accept" ? "Đồng ý để hệ thống tìm thợ thay thế" : "Từ chối đổi thợ và hủy đơn",
      orderId, orderCode: options.orderCode, orderVersion: options.orderVersion, decision,
      responseDeadline: options.responseDeadline,
      ...(cancellation ? { paidAmount: cancellation.paidAmount, refundAmount: cancellation.refundAmount,
        cancellationFee: cancellation.cancellationFee } : {}),
      note: decision === "accept" ? "Hệ thống tìm thợ phù hợp trên cùng đơn. Chưa bảo đảm có thợ nhận; không tạo đơn hoặc thu tiền thêm."
        : "Từ chối tìm người thay thế sẽ hủy đơn và xử lý hoàn tiền theo chính sách đang hiển thị." };
  },
  async respond(userId: string, orderId: string, decision: "accept" | "decline", confirmed: unknown) {
    const preview = await this.previewResponse(userId, orderId, decision);
    if (!isDeepStrictEqual(JSON.parse(JSON.stringify(preview)), confirmed)) throw new ActionPreconditionError();
    const order = await respondToProviderReassignment(orderId, userId, decision, preview.orderVersion,
      decision === "decline" ? { paidAmount: preview.paidAmount!, refundAmount: preview.refundAmount!,
        cancellationFee: preview.cancellationFee! } : undefined);
    return { orderId, orderCode: order.orderCode, status: order.status, reassignmentStatus: order.reassignment?.status };
  },
};
