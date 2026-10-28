import { Order } from "../models/order.model";
import { Provider } from "../models/provider.model";
import { AppError } from "../utils/appError";
import { getOrderTrackingState } from "./orderTracking.service";
import { z } from "zod";

export const agentAssignedProviderSchema = z.object({
  orderId: z.string(), orderCode: z.string(), status: z.string(), checkedAt: z.string(),
  provider: z.object({ id: z.string(), name: z.string(), phone: z.string().nullable(), averageRating: z.number(), totalCompletedOrders: z.number() }).nullable(),
  canContact: z.boolean(), canTrack: z.boolean(), location: z.object({ latitude: z.number(), longitude: z.number(), updatedAt: z.string() }).nullable(),
  trackingMessage: z.string(), path: z.string(), message: z.string(),
});

export const AgentAssignedProviderService = {
  async get(userId: string, orderId: string) {
    const order = await Order.findOne({ _id: orderId, customerId: userId, isDeleted: false })
      .select("orderCode status providerId").lean();
    if (!order) throw new AppError("Không tìm thấy đơn hàng của bạn.", 404);
    const active = ["accepted", "in_progress"].includes(order.status);
    const profile = order.providerId ? await Provider.findOne({ _id: order.providerId, isDeleted: false })
      .select("userId averageRating totalCompletedOrders")
      .populate<{ userId: { fullName: string; phone?: string } | null }>({ path: "userId", select: "fullName phone", match: { isDeleted: false } }).lean() : null;
    let location: { latitude: number; longitude: number; updatedAt: Date } | null = null;
    let trackingMessage = active ? "Thợ chưa chia sẻ vị trí." : "Theo dõi vị trí chỉ khả dụng khi thợ đã nhận đơn hoặc đang thực hiện.";
    if (active && profile?.userId) {
      try {
        location = (await getOrderTrackingState(orderId, userId, "CUSTOMER")).provider;
        if (location) trackingMessage = "Đây là vị trí được chia sẻ gần nhất, không phải cam kết thời gian đến.";
      } catch (error) {
        if (!(error instanceof AppError && error.statusCode < 500)) throw error;
        trackingMessage = "Chưa lấy được vị trí hiện tại. Bạn có thể mở chi tiết đơn để kiểm tra lại.";
      }
    }
    return { orderId, orderCode: order.orderCode, status: order.status, checkedAt: new Date().toISOString(),
      provider: profile?.userId ? { id: String(profile._id), name: profile.userId.fullName,
        phone: active ? profile.userId.phone ?? null : null, averageRating: profile.averageRating, totalCompletedOrders: profile.totalCompletedOrders } : null,
      canContact: active && Boolean(profile?.userId), canTrack: active && Boolean(profile?.userId),
      location: location ? { ...location, updatedAt: location.updatedAt.toISOString() } : null, trackingMessage, path: `/customer/bookings/${orderId}`,
      message: profile?.userId ? "Thông tin thợ thực tế được phân công cho đơn." : "Đơn hiện chưa có thông tin thợ thực hiện. Hãy kiểm tra lại sau khi hệ thống phân công." };
  },
};
