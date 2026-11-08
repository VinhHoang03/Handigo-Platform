import { Order } from "../models/order.model";
import { AppError } from "../utils/appError";
import { getOrderTrackingState } from "./orderTracking.service";
import { getDrivingRoute } from "./routing.service";
import { withAgentTimeout } from "../ai/agent/timeout";

const locationFresh = (updatedAt: Date) => {
  const age = Date.now() - new Date(updatedAt).getTime();
  return Number.isFinite(age) && age >= -5000 && age <= 60_000;
};

export async function getAgentArrivalEstimate(userId: string, orderId: string, signal: AbortSignal) {
  const order = await Order.findOne({ _id: orderId, customerId: userId, isDeleted: false })
    .select("orderCode status providerId arrival").lean();
  if (!order) throw new AppError("Không tìm thấy đơn hàng của bạn.", 404);
  const base = { orderId, orderCode: order.orderCode, path: `/customer/bookings/${orderId}`, checkedAt: new Date().toISOString() };
  if (order.arrival && String(order.arrival.providerId) === String(order.providerId)) {
    return { ...base, status: "arrived", message: "Thợ đã ghi nhận đến nơi cho đơn này." };
  }
  if (!order.providerId || !["accepted", "in_progress"].includes(order.status)) {
    return { ...base, status: "unavailable", message: "Chưa thể ước tính thời gian đến ở trạng thái hiện tại của đơn." };
  }
  const tracking = await getOrderTrackingState(orderId, userId, "CUSTOMER");
  if (!tracking.provider || !tracking.customer || !locationFresh(tracking.provider.updatedAt)) {
    return { ...base, status: "stale", message: "Chưa có GPS mới của thợ để ước tính thời gian đến. Bạn có thể mở theo dõi để kiểm tra." };
  }
  try {
    const route = await withAgentTimeout(getDrivingRoute(tracking.provider, tracking.customer), signal, 10_000);
    const current = await Order.findOne({ _id: orderId, customerId: userId, isDeleted: false })
      .select("status providerId arrival").lean();
    if (!current || String(current.providerId) !== String(order.providerId) || current.arrival
      || !["accepted", "in_progress"].includes(current.status)) {
      return { ...base, status: "unavailable", message: "Trạng thái đơn hoặc thợ đã thay đổi. Vui lòng kiểm tra lại thông tin theo dõi." };
    }
    if (!locationFresh(tracking.provider.updatedAt) || !Number.isFinite(route.durationSeconds) || route.durationSeconds < 0
      || !Number.isFinite(route.distanceMeters) || route.distanceMeters < 0) {
      return { ...base, status: "stale", message: "Dữ liệu vị trí chưa đủ mới để ước tính. Vui lòng kiểm tra lại." };
    }
    const minutes = Math.max(1, Math.ceil(route.durationSeconds / 60));
    return { ...base, status: "estimated", distanceMeters: route.distanceMeters, durationSeconds: route.durationSeconds,
      locationUpdatedAt: tracking.provider.updatedAt, estimatedArrivalAt: new Date(Date.now() + route.durationSeconds * 1000).toISOString(),
      message: `Theo vị trí vừa chia sẻ, tuyến đường còn khoảng ${(route.distanceMeters / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} km, thời gian di chuyển ước tính ${minutes} phút. Đây là ước tính tuyến đường, chưa tính thời gian thợ dừng chờ hoặc giao thông thực tế. Mở bản đồ để theo dõi cập nhật trực tiếp.` };
  } catch {
    signal.throwIfAborted();
    return { ...base, status: "unavailable", message: "Chưa lấy được tuyến đường để ước tính thời gian đến. Bạn có thể mở theo dõi hoặc liên hệ thợ." };
  }
}
