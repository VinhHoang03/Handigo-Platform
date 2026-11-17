import type { Server } from "socket.io";
import { Conversation } from "../models/conversation.model";
import { Provider } from "../models/provider.model";
import { Order } from "../models/order.model";
import { createLogger } from "../utils/logger";

let socketServer: Server | null = null;
const logger = createLogger("SocketServer");

export const setSocketServer = (io: Server) => {
  socketServer = io;
};

/** Đếm theo phòng tài khoản đã xác thực, không đếm trùng các tab/thiết bị. */
export const getOnlineUserIds = async (): Promise<string[] | null> => {
  if (!socketServer) return null;
  const sockets = await socketServer.fetchSockets();
  const ids = new Set<string>();
  for (const socket of sockets) {
    for (const room of socket.rooms) {
      const match = /^user:([a-f\d]{24})$/i.exec(room);
      if (match) ids.add(match[1]);
    }
  }
  return [...ids];
};

export const emitToUser = (userId: string, event: string, payload: unknown) => {
  socketServer?.to(`user:${userId}`).emit(event, payload);
  if (event === "provider:availability") publishProviderDiscoveryChanged();
};

// Chỉ báo dữ liệu đã đổi; khách phải gọi lại API có kiểm tra điều kiện nhận việc.
export const publishProviderDiscoveryChanged = () => {
  socketServer?.to("provider-discovery").emit("providers:changed", {});
};

export const publishProviderLocationChanged = async (userId: string) => {
  if (!socketServer) return;
  const provider = await Provider.findOne({ userId, verified: true, isDeleted: false }).select("_id").lean();
  if (!provider) return;
  publishProviderDiscoveryChanged();
  const orders = await Order.find({ providerId: provider._id, status: { $in: ["accepted", "in_progress"] }, isDeleted: false })
    .select("_id customerId").lean();
  for (const order of orders) {
    emitToUser(String(order.customerId), "order:location", { orderId: String(order._id) });
  }
};

export const emitToConversation = (conversationId: string, event: string, payload: unknown) => {
  if (!socketServer) return;
  // Chat giữ đúng khách và thợ của cuộc trò chuyện, không phát lịch sử cho thợ được giao lại.
  void (async () => {
    const conversation = await Conversation.findOne({ _id: conversationId, isDeleted: false }).select("customerId providerId").lean();
    if (!conversation) return;
    const provider = await Provider.findOne({ _id: conversation.providerId, isDeleted: false }).select("userId").lean();
    if (!provider) return;
    socketServer?.to([`user:${conversation.customerId}`, `user:${provider.userId}`]).emit(event, payload);
  })().catch((error) => logger.error("Không thể gửi sự kiện trò chuyện.", error, { conversationId }));
};

export const disconnectUserSockets = (userId: string) => {
  socketServer?.in(`user:${userId}`).disconnectSockets(true);
};

export const disconnectSessionSockets = (sessionId: string) => {
  socketServer?.in(`session:${sessionId}`).disconnectSockets(true);
};
