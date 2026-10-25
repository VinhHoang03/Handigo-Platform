import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { Server, Socket } from "socket.io";
import User from "../models/user.model";
import * as chatService from "../services/chat.service";
import * as orderTrackingService from "../services/orderTracking.service";
import { setSocketServer, emitToConversation } from "./socketServer";
import { isAllowedOrigin } from "../configs/cors";
import {
  conversationIdParamSchema,
  sendMessageSchema,
} from "../validations/chat.validator";
import { currentLocationSchema } from "../validations/location.validator";
import { orderIdParamSchema } from "../validations/order.validator";
import { markProviderOffline, restoreProviderAfterReconnect } from "../services/providerPresence.service";
import { createLogger } from "../utils/logger";
import { isTokenVersionCurrent } from "../utils/token";

const PROVIDER_OFFLINE_GRACE_MS = 30_000;
const socketLogger = createLogger("SocketServer");

const getAccessSecret = (): string => {
  const secret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("Chưa cấu hình ACCESS_TOKEN_SECRET hoặc JWT_SECRET.");
  }

  return secret;
};

interface SocketUser {
  tokenVersion?: number;
  id: string;
  email: string;
  role: "CUSTOMER" | "PROVIDER" | "ADMIN";
}

type AuthedSocket = Socket & {
  user?: SocketUser;
};

export const initSocket = (server: HttpServer) => {
  const providerOfflineTimers = new Map<string, NodeJS.Timeout>();
  const disconnectedProviders = new Map<string, Promise<Date | null>>();
  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          return callback(null, true);
        }
        return callback(new Error("Nguồn kết nối socket không được phép."));
      },
      credentials: true,
    },
  });
  setSocketServer(io);

  io.use(async (socket: AuthedSocket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token || typeof token !== "string") {
        return next(new Error("Thiếu mã xác thực kết nối socket"));
      }

      const decoded = jwt.verify(token, getAccessSecret()) as SocketUser;
      const user = await User.findOne({ _id: decoded.id, isDeleted: false });

      if (!user || user.status === "locked") {
        return next(new Error("Người dùng không được phép kết nối socket"));
      }

      if (!isTokenVersionCurrent(decoded, user)) {
        return next(new Error("Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại."));
      }

      socket.user = {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        tokenVersion: decoded.tokenVersion ?? 0,
      };
      next();
    } catch (error) {
      next(new Error("Mã xác thực kết nối socket không hợp lệ"));
    }
  });

  io.on("connection", (socket: AuthedSocket) => {
    const socketUser = socket.user!;
    socket.on("error", (error: Error) => {
      socketLogger.warn("Sự kiện socket bị từ chối.", { userId: socketUser.id, message: error.message });
    });
    socket.use(async (_packet, next) => {
      try {
        const current = await User.findOne({ _id: socketUser.id, isDeleted: false }).select("status role tokenVersion").lean();
        if (!current || current.status === "locked" || current.role !== socketUser.role || !isTokenVersionCurrent(socketUser, current)) {
          next(new Error("Tài khoản không còn quyền sử dụng kết nối này."));
          socket.disconnect(true);
          return;
        }
        next();
      } catch {
        next(new Error("Chưa thể kiểm tra quyền sử dụng kết nối. Vui lòng thử lại."));
      }
    });
    const userRoom = `user:${socketUser.id}`;
    socket.join(userRoom);
    // Kiểm tra lại sau khi vào room để chặn phiên đổi mật khẩu giữa lúc bắt tay và kết nối.
    void User.findOne({ _id: socketUser.id, isDeleted: false })
      .select("status role tokenVersion")
      .lean()
      .then((current) => {
        if (!current || current.status === "locked" || current.role !== socketUser.role || !isTokenVersionCurrent(socketUser, current)) {
          socket.disconnect(true);
        }
      })
      .catch(() => socket.disconnect(true));

    if (socketUser.role === "PROVIDER") {
      const pendingOfflineTimer = providerOfflineTimers.get(socketUser.id);
      if (pendingOfflineTimer) {
        clearTimeout(pendingOfflineTimer);
        providerOfflineTimers.delete(socketUser.id);
      }
      const offlineChange = disconnectedProviders.get(socketUser.id);
      if (offlineChange) {
        disconnectedProviders.delete(socketUser.id);
        void offlineChange.then(async (disconnectedAt) => {
          if (!disconnectedAt) return;
          const activeSockets = await io.in(userRoom).fetchSockets();
          if (!activeSockets.length) {
            if (!disconnectedProviders.has(socketUser.id)) disconnectedProviders.set(socketUser.id, offlineChange);
            return;
          }
          if (await restoreProviderAfterReconnect(socketUser.id, disconnectedAt)) {
            io.to(userRoom).emit("provider:availability", { availabilityStatus: "online" });
            socketLogger.info("Đã khôi phục nhận việc sau khi provider kết nối lại.", { userId: socketUser.id });
          }
        }).catch((error) => {
          socketLogger.error("Không thể khôi phục trạng thái nhận việc sau khi kết nối lại.", error, { userId: socketUser.id });
        });
      }
    }

    socket.on("disconnect", (reason) => {
      if (socketUser.role !== "PROVIDER") return;

      const existingTimer = providerOfflineTimers.get(socketUser.id);
      if (existingTimer) clearTimeout(existingTimer);

      const timer = setTimeout(async () => {
        try {
          const activeSockets = await io.in(userRoom).fetchSockets();
          if (activeSockets.length === 0 && providerOfflineTimers.get(socketUser.id) === timer) {
            const offlineChange = markProviderOffline(socketUser.id, true);
            disconnectedProviders.set(socketUser.id, offlineChange);
            try {
              const disconnectedAt = await offlineChange;
              if (disconnectedAt) {
                socketLogger.info("Tạm ngừng nhận việc vì provider mất toàn bộ kết nối quá thời gian chờ.", {
                  userId: socketUser.id, reason, graceMs: PROVIDER_OFFLINE_GRACE_MS,
                });
              } else if (disconnectedProviders.get(socketUser.id) === offlineChange) {
                disconnectedProviders.delete(socketUser.id);
              }
            } catch (error) {
              if (disconnectedProviders.get(socketUser.id) === offlineChange) disconnectedProviders.delete(socketUser.id);
              throw error;
            }
          }
        } catch (error) {
          socketLogger.error(
            "Không thể cập nhật provider về trạng thái ngoại tuyến.",
            error,
            { userId: socketUser.id },
          );
        } finally {
          if (providerOfflineTimers.get(socketUser.id) === timer) providerOfflineTimers.delete(socketUser.id);
        }
      }, PROVIDER_OFFLINE_GRACE_MS);

      timer.unref();
      providerOfflineTimers.set(socketUser.id, timer);
    });

    socket.on("conversation:join", async (payload, callback) => {
      try {
        const { conversationId } = conversationIdParamSchema.parse(payload);
        await chatService.getMessages(socket.user!.id, socket.user!.role, conversationId, {
          page: 1,
          limit: 1,
        });
        socket.join(`conversation:${conversationId}`);
        callback?.({ success: true });
      } catch (error: any) {
        callback?.({ success: false, message: error.message });
      }
    });

    socket.on("message:send", async (payload, callback) => {
      try {
        const { conversationId } = conversationIdParamSchema.parse(payload);
        const messagePayload = sendMessageSchema.parse(payload);
        const message = await chatService.sendMessage(
          socket.user!.id,
          socket.user!.role,
          conversationId,
          messagePayload,
        );
        emitToConversation(conversationId, "message:new", message);
        callback?.({ success: true, data: message });
      } catch (error: any) {
        callback?.({ success: false, message: error.message });
      }
    });

    socket.on("conversation:seen", async (payload, callback) => {
      try {
        const { conversationId } = conversationIdParamSchema.parse(payload);
        const result = await chatService.markConversationSeen(
          socket.user!.id,
          socket.user!.role,
          conversationId,
        );
        emitToConversation(conversationId, "message:seen", result);
        callback?.({ success: true, data: result });
      } catch (error: any) {
        callback?.({ success: false, message: error.message });
      }
    });

    socket.on("order:tracking:join", async (payload, callback) => {
      try {
        const { orderId } = orderIdParamSchema.parse(payload);
        const trackingState = await orderTrackingService.getOrderTrackingState(
          orderId,
          socket.user!.id,
          socket.user!.role as "CUSTOMER" | "PROVIDER",
        );
        socket.join(`order:${orderId}`);
        callback?.({ success: true, data: trackingState });
      } catch (error: any) {
        callback?.({ success: false, message: error.message });
      }
    });

    socket.on("order:location:update", async (payload, callback) => {
      try {
        const { orderId } = orderIdParamSchema.parse(payload);
        const coordinates = currentLocationSchema.parse({
          latitude: Number(payload?.latitude),
          longitude: Number(payload?.longitude),
        });
        const location = await orderTrackingService.updateOrderTrackingLocation(
          orderId,
          socket.user!.id,
          socket.user!.role as "CUSTOMER" | "PROVIDER",
          coordinates,
        );
        // Kiểm tra lại phân công sau khi lưu vị trí; room đơn có thể còn socket của thợ cũ.
        const recipients = await orderTrackingService.getOrderTrackingRecipientIds(orderId, socket.user!.id);
        const sockets = await io.in(`order:${orderId}`).fetchSockets();
        const recipientRooms = recipients.map((userId) => `user:${userId}`);
        const socketIds = sockets.filter((member) =>
          recipientRooms.some((room) => member.rooms.has(room))).map((member) => member.id);
        if (socketIds.length) io.to(socketIds).emit("order:location", location);
        callback?.({ success: true, data: location });
      } catch (error: any) {
        callback?.({ success: false, message: error.message });
      }
    });
  });

  return io;
};
