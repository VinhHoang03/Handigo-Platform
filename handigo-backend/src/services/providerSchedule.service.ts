import mongoose, { ClientSession, Types } from "mongoose";
import { Order, IOrder } from "../models/order.model";
import { Provider } from "../models/provider.model";
import { AppError } from "../utils/appError";
import { intervalsConflict, ScheduleInterval } from "../utils/bookingPolicy";
import { getOrderInterval, isWithinWorkingCalendar } from '../utils/providerSchedule';
import { BookingPolicy } from "../validations/bookingPolicy.validator";
import { getBookingPolicy } from "./systemConfig.service";
import { createNotificationRecord } from "./notification.service";

export { getOrderInterval, isWithinWorkingCalendar } from '../utils/providerSchedule';

export const getAvailableProviderIds = async (
  providerIds: Types.ObjectId[],
  intervals: ScheduleInterval[],
  options: { policy?: BookingPolicy; excludeOrderIds?: Types.ObjectId[]; session?: ClientSession } = {},
) => {
  const policy = options.policy ?? await getBookingPolicy();
  if (intervals.some((interval, index) => intervals.slice(index + 1).some((other) => intervalsConflict(interval, other)))) return new Set<string>();
  const orders = await Order.find({
    providerId: { $in: providerIds },
    _id: { $nin: options.excludeOrderIds ?? [] },
    status: { $in: ["accepted", "in_progress"] },
    isDeleted: false,
  }).session(options.session ?? null);
  return new Set(providerIds.filter((id) => {
    if (!intervals.every((interval) => isWithinWorkingCalendar(id.toString(), interval, policy))) return false;
    return !orders.some((order) => order.providerId?.toString() === id.toString()
      && intervals.some((interval) => intervalsConflict(getOrderInterval(order, policy), interval)));
  }).map(String));
};

export const lockProviderSchedule = async (providerId: Types.ObjectId, session: ClientSession) => {
  // Mọi giao dịch giữ lịch cùng ghi vào một document để MongoDB phát hiện xung đột.
  const provider = await Provider.findOneAndUpdate(
    { _id: providerId, verified: true, isDeleted: false },
    { $inc: { scheduleVersion: 1 } },
    { new: true, session, runValidators: true },
  );
  if (!provider) throw new AppError("Chuyên gia không còn khả dụng.", 409);
  return provider;
};

export const assertProviderSchedule = async (providerId: Types.ObjectId, orders: IOrder[], session: ClientSession, policy: BookingPolicy) => {
  const intervals = orders.map((order) => getOrderInterval({ ...order.toObject(), status: "created" }, policy));
  const available = await getAvailableProviderIds([providerId], intervals, { policy, session, excludeOrderIds: orders.map((order) => order._id as Types.ObjectId) });
  if (!available.has(providerId.toString())) throw new AppError("Lịch làm việc không đủ thời gian thực hiện, dự phòng và di chuyển. Vui lòng chọn thời điểm khác.", 409);
};

export const updateExpectedEnd = async (orderId: string, userId: string, expectedEndAt: Date) => {
  const identity = await Provider.findOne({ userId, verified: true, isDeleted: false });
  if (!identity) throw new AppError("Không tìm thấy chuyên gia.", 404);
  const policy = await getBookingPolicy();
  const session = await mongoose.startSession();
  let affected: IOrder[] = [];
  try {
    const result = await session.withTransaction(async () => {
      await lockProviderSchedule(identity._id as Types.ObjectId, session);
      const order = await Order.findOne({ _id: orderId, providerId: identity._id, status: "in_progress", isDeleted: false }).session(session);
      if (!order) throw new AppError("Chỉ cập nhật thời gian cho đơn đang thực hiện của bạn.", 409);
      if (!Number.isFinite(expectedEndAt.getTime()) || expectedEndAt.getTime() <= Date.now() || expectedEndAt.getTime() > Date.now() + 24 * 3600000) throw new AppError("Giờ hoàn thành phải trong vòng 24 giờ tới.", 400);
      const interval = getOrderInterval(order, policy);
      order.schedule = { durationMinutes: order.schedule?.durationMinutes ?? policy.defaultDurationMinutes, bufferMinutes: interval.bufferMinutes, travelMinutes: interval.travelMinutes, expectedStartAt: new Date(interval.start), expectedEndAt };
      await order.save({ session });
      const upcoming = await Order.find({ _id: { $ne: order._id }, providerId: identity._id, status: "accepted", isDeleted: false }).session(session);
      affected = upcoming.filter((other) => intervalsConflict(getOrderInterval(order, policy), getOrderInterval(other, policy)));
      return order;
    });
    if (!result) throw new AppError("Không thể cập nhật giờ hoàn thành.", 409);
    for (const order of affected) {
      await createNotificationRecord({ userId: order.customerId, type: "ORDER", title: "Lịch hẹn có nguy cơ chậm", content: `Công việc trước của chuyên gia kéo dài và có thể ảnh hưởng đơn ${order.orderCode}. Vui lòng liên hệ chuyên gia hoặc bộ phận hỗ trợ để thống nhất lịch.`, data: { orderId: order._id } }, { emitRealtime: true });
    }
    return { order: result, affectedOrderCount: affected.length };
  } finally { await session.endSession(); }
};
