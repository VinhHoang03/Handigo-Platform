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
import { trackingLocationSchema } from "../validations/location.validator";
import { orderIdParamSchema } from "../validations/order.validator";
import { createLogger } from "../utils/logger";
import { isTokenVersionCurrent } from "../utils/token";
import { refreshAccountLock } from "../services/penaltyPolicy.service";
import { getEffectiveUserRole } from "../utils/userRole";
import { Session } from "../models/session.model";

const socketLogger = createLogger("SocketServer");

const getAccessSecret = (): string => {
  const secret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("Chưa cấu hình ACCESS_TOKEN_SECRET hoặc JWT_SECRET.");
  }

  return secret;
};

interface SocketUser {
  sessionId?: string;
  tokenVersion?: number;
  id: string;
  email: string;
  role: "CUSTOMER" | "PROVIDER" | "ADMIN";
}

type AuthedSocket = Socket & {
  user?: SocketUser;
};

const hasActiveSession = async (user: SocketUser) => !user.sessionId || Boolean(await Session.exists({
  _id: user.sessionId, userId: user.id, revokedAt: null, expiresAt: { $gt: new Date() }, isDeleted: false,
}));

export const initSocket = (server: HttpServer) => {
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
      if (user) await refreshAccountLock(user);

      if (!user || user.status === "locked") {
        return next(new Error("Người dùng không được phép kết nối socket"));
      }

      if (!isTokenVersionCurrent(decoded, user)) {
        return next(new Error("Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại."));
      }
      if (!await hasActiveSession(decoded)) {
        return next(new Error("Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại."));
      }

      socket.user = {
        id: user._id.toString(),
        email: user.email,
        role: getEffectiveUserRole(user),
        tokenVersion: decoded.tokenVersion ?? 0,
        sessionId: decoded.sessionId,
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
        const current = await User.findOne({ _id: socketUser.id, isDeleted: false }).select("status role tokenVersion providerOnboardingStatus").lean();
        if (!current || current.status === "locked" || getEffectiveUserRole(current) !== socketUser.role || !isTokenVersionCurrent(socketUser, current) || !await hasActiveSession(socketUser)) {
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
    if (socketUser.sessionId) socket.join(`session:${socketUser.sessionId}`);
    // Kiểm tra lại sau khi vào room để chặn phiên đổi mật khẩu giữa lúc bắt tay và kết nối.
    void User.findOne({ _id: socketUser.id, isDeleted: false })
      .select("status role tokenVersion providerOnboardingStatus")
      .lean()
      .then(async (current) => {
        if (!current || current.status === "locked" || getEffectiveUserRole(current) !== socketUser.role || !isTokenVersionCurrent(socketUser, current) || !await hasActiveSession(socketUser)) {
          socket.disconnect(true);
        }
      })
      .catch(() => socket.disconnect(true));

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
        const coordinates = trackingLocationSchema.parse({
          latitude: Number(payload?.latitude),
          longitude: Number(payload?.longitude),
          accuracy: payload?.accuracy,
          capturedAt: payload?.capturedAt,
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
