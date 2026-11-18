import { Order, type IOrder } from "../models/order.model";
import { Provider } from "../models/provider.model";
import { startSession } from "mongoose";
import { haversineMeters } from "./matching.service";
import { createNotificationRecord, emitRealtimeNotification } from "./notification.service";
import { withTransactionRetry } from "../utils/transaction";
import type { CurrentLocationPayload as TrackingLocationPayload } from "../validations/location.validator";

export const detectProviderMovementFromLocation = async (userId: string, payload: TrackingLocationPayload) => {
  if (payload.accuracy === undefined || payload.accuracy > 50 || payload.capturedAt === undefined) return;
  const provider = await Provider.findOne({ userId, verified: true, isDeleted: false }).select("_id").lean();
  if (!provider) return;
  const orders = await Order.find({ providerId: provider._id, status: "accepted", isDeleted: false }).select("_id").lean();
  for (const order of orders) {
    await detectProviderMovement(String(order._id), provider._id, payload);
  }
};

// Chỉ xác nhận từ GPS mới, sai số tối đa 50 m, qua hai mẫu cách nhau ít nhất 8 giây.
const detectProviderMovement = async (orderId: string, providerId: IOrder["providerId"], payload: TrackingLocationPayload) => {
  const now = Date.now();
  if (payload.accuracy === undefined || !Number.isFinite(payload.accuracy) || payload.accuracy < 0 || payload.accuracy > 50 ||
    payload.capturedAt === undefined || !Number.isFinite(payload.capturedAt) ||
    payload.capturedAt > now + 5000 || now - payload.capturedAt > 30_000) return;

  const session = await startSession();
  try {
    const notification = await withTransactionRetry(session, async () => {
      const order = await Order.findOne({ _id: orderId, providerId, status: "accepted", isDeleted: false })
        .select("customerId orderCode arrival +movementTracking").session(session).lean();
      if (!order || (order.arrival && String(order.arrival.providerId) === String(providerId))) return null;
      const sampleAt = new Date(payload.capturedAt!);
      const previous = order.movementTracking;
      const sameProvider = previous && String(previous.providerId) === String(providerId);
      if (sameProvider && (previous.notifiedAt || sampleAt.getTime() - previous.lastSampleAt.getTime() < 8000)) return null;

      const tracking = sameProvider ? { ...previous } : {
        providerId: providerId!, latitude: payload.latitude, longitude: payload.longitude,
        lastSampleAt: sampleAt, confirmationStartedAt: null, notifiedAt: null,
      };
      let startedMoving = false;
      if (sameProvider) {
        const distance = haversineMeters(tracking.latitude, tracking.longitude, payload.latitude, payload.longitude);
        if (distance >= 200) {
          startedMoving = Boolean(tracking.confirmationStartedAt &&
            sampleAt.getTime() - previous.lastSampleAt.getTime() <= 60_000);
          tracking.confirmationStartedAt = startedMoving ? tracking.confirmationStartedAt : sampleAt;
        } else tracking.confirmationStartedAt = null;
      }
      tracking.lastSampleAt = sampleAt;
      if (startedMoving) tracking.notifiedAt = new Date();
      await Order.updateOne({ _id: order._id, providerId, status: "accepted", isDeleted: false },
        { $set: { movementTracking: tracking } }, { session, runValidators: true });
      if (!startedMoving) return null;
      return createNotificationRecord({
        userId: order.customerId, type: "ORDER", title: "Thợ đã bắt đầu di chuyển",
        content: `Thợ của đơn ${order.orderCode} đã bắt đầu di chuyển. Bạn có thể theo dõi vị trí và thời gian dự kiến đến trên bản đồ.`,
        data: { orderId: String(order._id), action: "provider_started_moving" },
      }, { session, deferRealtime: true });
    });
    if (notification) emitRealtimeNotification(notification);
  } finally { await session.endSession(); }
};

