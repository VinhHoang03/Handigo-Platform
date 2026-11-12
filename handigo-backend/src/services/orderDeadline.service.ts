import { connection } from "mongoose";
import { IOrder, Order } from "../models/order.model";
import { Provider } from "../models/provider.model";
import { emitToUser } from "../sockets/socketServer";
import { AppError } from "../utils/appError";
import { createLogger } from "../utils/logger";
import { createNotificationRecord, emitRealtimeNotification } from "./notification.service";
import { cancelSystemOrderWithSettlement } from "./orderCancellation.service";
import { reconcilePayosPaymentForExpiration } from "./payment.service";
import { getBookingPolicy } from "./systemConfig.service";

const hour = 3_600_000;
const confirmationWindow = 15 * 60_000;
const timers = new Map<string, NodeJS.Timeout>();
const logger = createLogger("OrderDeadline");

export function deadlineFor(order: IOrder) {
  if (order.isDeleted) return null;
  if (order.status === "created" || (order.status === "accepted" && order.bookingStatus === "awaiting_payment")) {
    if (order.paymentDueAt && order.paymentMethod !== "cash" && order.paymentStatus === "unpaid") {
      return { kind: "payment" as const, at: order.paymentDueAt };
    }
  }
  if (order.status === "accepted" && order.providerId && !order.arrival && !order.customerNoShow) {
    const expected = order.schedule?.expectedStartAt ?? order.scheduledAt;
    if (expected) return { kind: "arrival" as const, at: new Date(expected.getTime() + hour) };
  }
  if (order.status === "in_progress" && order.workConfirmation) {
    return order.workConfirmation.expiresAt
      ? { kind: "work_timeout" as const, at: order.workConfirmation.expiresAt }
      : { kind: "work_open" as const, at: order.workConfirmation.nextAt };
  }
  return null;
}

function arm(orderId: string, at: Date) {
  const previous = timers.get(orderId);
  if (previous) clearTimeout(previous);
  const timer = setTimeout(() => {
    timers.delete(orderId);
    void processDeadline(orderId).catch((error: unknown) => {
      logger.error("Không thể xử lý hạn của đơn hàng.", error, { orderId });
      arm(orderId, new Date(Date.now() + 60_000));
    });
  }, Math.min(Math.max(at.getTime() - Date.now(), 1), 2_147_483_647));
  timers.set(orderId, timer);
  timer.unref();
}

export function scheduleOrderDeadline(order: IOrder) {
  const deadline = deadlineFor(order);
  if (deadline) arm(order._id.toString(), deadline.at);
}

async function processDeadline(orderId: string) {
  const order = await Order.findById(orderId);
  if (!order) return;
  const deadline = deadlineFor(order);
  if (!deadline) return;
  if (deadline.at.getTime() > Date.now()) return scheduleOrderDeadline(order);

  if (deadline.kind === "payment") {
    const { order: current } = await reconcilePayosPaymentForExpiration(orderId);
    if (!current) return;
    const currentDeadline = deadlineFor(current);
    if (currentDeadline?.kind !== "payment") return scheduleOrderDeadline(current);
    if (currentDeadline.at > new Date()) return scheduleOrderDeadline(current);
    await cancelSystemOrderWithSettlement(orderId, "Đã hết thời hạn thanh toán đơn hàng.", "payment_timeout", current.updatedAt);
  } else if (deadline.kind === "arrival") {
    await cancelSystemOrderWithSettlement(orderId, "Thợ chưa đến sau 1 giờ kể từ giờ dự kiến bắt đầu.", "provider_late", order.updatedAt);
  } else if (deadline.kind === "work_timeout") {
    await cancelSystemOrderWithSettlement(orderId, "Thợ không xác nhận đang làm việc đúng hạn.", "work_confirmation_timeout", order.updatedAt);
  } else {
    const opened = await connection.transaction(async session => {
      const current = await Order.findOneAndUpdate({ _id: orderId, status: "in_progress", isDeleted: false,
        "workConfirmation.nextAt": deadline.at, "workConfirmation.expiresAt": null },
      { $set: { "workConfirmation.expiresAt": new Date(Date.now() + confirmationWindow) } },
      { returnDocument: "after", runValidators: true, session });
      if (!current) return null;
      const provider = await Provider.findById(current.providerId).select("userId").session(session);
      if (!provider) throw new AppError("Không tìm thấy thợ để gửi yêu cầu xác nhận.", 409);
      const notification = await createNotificationRecord({ userId: provider.userId, type: "ORDER", title: "Xác nhận đang làm việc",
        content: `Vui lòng xác nhận trong 15 phút cho đơn ${current.orderCode}.`, data: { orderId } }, { session, deferRealtime: true });
      return { current, notification, providerUserId: provider.userId.toString() };
    });
    if (!opened) return;
    scheduleOrderDeadline(opened.current);
    emitRealtimeNotification(opened.notification);
    emitToUser(opened.providerUserId, "order:updated", { orderId });
    emitToUser(opened.providerUserId, "order:work-confirmation", { orderId });
    return;
  }
  // Nếu đơn vừa thay đổi trong lúc xử lý, đọc lại để xét hạn theo trạng thái mới.
  const current = await Order.findById(orderId);
  if (current && deadlineFor(current)) arm(orderId, new Date(Date.now() + 1000));
}

export async function recoverOrderDeadlines(orderIds?: string[]) {
  const scope = orderIds ? { _id: { $in: orderIds } } : {};
  const booking = await getBookingPolicy();
  const unpaidDrafts = Order.find({ ...scope, status: "created", paymentDueAt: null, paymentStatus: "unpaid",
    paymentMethod: { $in: ["bank", "wallet"] }, readyForMatching: false, isDeleted: false }).cursor();
  for await (const order of unpaidDrafts) {
    const paymentDueAt = new Date(order.createdAt.getTime() + booking.paymentHoldMinutes * 60_000);
    await Order.updateOne({ _id: order._id, status: "created", paymentStatus: "unpaid", paymentDueAt: null,
      paymentMethod: order.paymentMethod, readyForMatching: false, isDeleted: false },
    { $set: { paymentDueAt } }, { runValidators: true });
  }
  const orders = Order.find({ ...scope, isDeleted: false, $or: [
    { status: "created", paymentDueAt: { $ne: null }, paymentStatus: "unpaid", paymentMethod: { $ne: "cash" } },
    { status: "accepted", $or: [{ arrival: null }, { bookingStatus: "awaiting_payment" }] },
    { status: "in_progress", workConfirmation: { $ne: null } },
  ] }).cursor();
  let failed = 0;
  for await (const order of orders) {
    const deadline = deadlineFor(order);
    if (!deadline) continue;
    if (deadline.at > new Date()) {
      scheduleOrderDeadline(order);
      continue;
    }
    const orderId = order._id.toString();
    const timer = timers.get(orderId);
    if (timer) clearTimeout(timer);
    timers.delete(orderId);
    try { await processDeadline(orderId); }
    catch (error) {
      failed++;
      logger.error("Không thể xử lý hạn của đơn trong lượt quét.", error, { orderId });
    }
  }
  return failed;
}

export function stopOrderDeadlines() {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
}

export async function confirmOrderWork(orderId: string, providerUserId: string) {
  const provider = await Provider.findOne({ userId: providerUserId, isDeleted: false }).select("_id");
  if (!provider) throw new AppError("Không tìm thấy hồ sơ thợ.", 404);
  const now = new Date();
  const order = await Order.findOne({ _id: orderId, providerId: provider._id, isDeleted: false }).select("workConfirmation status");
  if (!order) throw new AppError("Không tìm thấy đơn hàng của bạn.", 404);
  const window = order.workConfirmation;
  if (order.status !== "in_progress" || !window?.expiresAt || window.expiresAt <= now) {
    throw new AppError("Đơn hàng hiện không có lượt xác nhận đang mở.", 409);
  }
  const next = await Order.findOneAndUpdate({ _id: orderId, providerId: provider._id, status: "in_progress", isDeleted: false,
    "workConfirmation.expiresAt": { $eq: window.expiresAt, $gt: new Date() } },
  { $set: { workConfirmation: { nextAt: new Date(window.expiresAt.getTime() - confirmationWindow + hour) } } },
  { returnDocument: "after", runValidators: true });
  if (!next) throw new AppError("Lượt xác nhận vừa kết thúc hoặc đã được xử lý.", 409);
  scheduleOrderDeadline(next);
  return next.workConfirmation;
}
