import type { Server } from "socket.io";
import { Conversation } from "../models/conversation.model";
import { Order } from "../models/order.model";
import { Provider } from "../models/provider.model";
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
};

export const emitToConversation = (conversationId: string, event: string, payload: unknown) => {
  if (!socketServer) return;
  // Người tham gia hiện tại của đơn quyết định người nhận, không dùng room của thợ cũ.
  void (async () => {
    const conversation = await Conversation.findOne({ _id: conversationId, isDeleted: false }).select("orderId").lean();
    if (!conversation) return;
    const order = await Order.findOne({ _id: conversation.orderId, isDeleted: false }).select("customerId providerId").lean();
    if (!order?.providerId) return;
    const provider = await Provider.findOne({ _id: order.providerId, isDeleted: false }).select("userId").lean();
    if (!provider) return;
    socketServer?.to([`user:${order.customerId}`, `user:${provider.userId}`]).emit(event, payload);
  })().catch((error) => logger.error("Không thể gửi sự kiện trò chuyện.", error, { conversationId }));
};

export const disconnectUserSockets = (userId: string) => {
  socketServer?.in(`user:${userId}`).disconnectSockets(true);
};
