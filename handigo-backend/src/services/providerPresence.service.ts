import { Provider } from "../models/provider.model";
import { Order } from "../models/order.model";
import type { ClientSession, Types } from "mongoose";
import { emitToUser } from "../sockets/socketServer";

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
  if (provider) emitToUser(userId, "provider:availability", { availabilityStatus: "offline" });
  return provider?.updatedAt ?? null;
};
