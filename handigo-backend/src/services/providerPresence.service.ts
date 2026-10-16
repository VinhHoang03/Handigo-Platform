import { Provider } from "../models/provider.model";

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
