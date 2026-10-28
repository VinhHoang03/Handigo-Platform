import { Provider } from "../models/provider.model";
import { Order } from "../models/order.model";
import type { ClientSession, Types } from "mongoose";

// Gọi trong giao dịch đã khóa lịch thợ; báo cáo chờ duyệt không còn giữ thợ bận.
export const releaseProviderAfterNoShow = async (providerId: Types.ObjectId, orderId: Types.ObjectId, session: ClientSession) => {
  const hasOtherWork = await Order.exists({
    _id: { $ne: orderId }, providerId, isDeleted: false,
    $or: [{ status: "in_progress" }, {
      status: "accepted", orderType: { $in: ["normal", "urgent"] }, "customerNoShow.status": { $ne: "pending" },
    }],
  }).session(session);
  if (!hasOtherWork) await Provider.updateOne({ _id: providerId, availabilityStatus: "busy", isDeleted: false },
    { $set: { availabilityStatus: "online" } }, { session, runValidators: true });
};

export const markProviderOffline = async (userId: string, onlyOnline = false) => {
  const provider = await Provider.findOneAndUpdate(
    { userId, isDeleted: false, ...(onlyOnline ? { availabilityStatus: "online" } : {}) },
    { $set: { availabilityStatus: "offline" } },
    { new: true, runValidators: true, projection: { updatedAt: 1 } },
  ).lean();
  return provider?.updatedAt ?? null;
};

export const restoreProviderAfterReconnect = async (userId: string, disconnectedAt: Date) => {
  // Chỉ khôi phục đúng lần tắt do mất kết nối; không ghi đè thao tác tắt, đăng xuất hoặc trạng thái bận mới hơn.
  const result = await Provider.updateOne(
    { userId, isDeleted: false, verified: true, availabilityStatus: "offline", updatedAt: disconnectedAt },
    { $set: { availabilityStatus: "online" } },
    { runValidators: true },
  );
  return result.modifiedCount > 0;
};
