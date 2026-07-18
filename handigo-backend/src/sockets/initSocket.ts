import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { Server, Socket } from "socket.io";
import User from "../models/user.model";
import * as chatService from "../services/chat.service";
import * as orderTrackingService from "../services/orderTracking.service";
import { setSocketServer } from "./socketServer";
import { isAllowedOrigin } from "../configs/cors";
import {
  conversationIdParamSchema,
  sendMessageSchema,
} from "../validations/chat.validator";
import { currentLocationSchema } from "../validations/location.validator";
import { orderIdParamSchema } from "../validations/order.validator";

const getAccessSecret = (): string => {
  const secret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("ACCESS_TOKEN_SECRET or JWT_SECRET is not defined.");
  }

  return secret;
};

interface SocketUser {
  id: string;
  email: string;
  role: "CUSTOMER" | "PROVIDER" | "ADMIN";
}

type AuthedSocket = Socket & {
  user?: SocketUser;
};

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
        return next(new Error("Missing socket token"));
      }

      const decoded = jwt.verify(token, getAccessSecret()) as SocketUser;
      const user = await User.findOne({ _id: decoded.id, isDeleted: false });

      if (!user || user.status === "locked") {
        return next(new Error("Socket user is not allowed"));
      }

      socket.user = {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      };
      next();
    } catch (error) {
      next(new Error("Invalid socket token"));
    }
  });

  io.on("connection", (socket: AuthedSocket) => {
    socket.join(`user:${socket.user!.id}`);

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
        io.to(`conversation:${conversationId}`).emit("message:new", message);
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
        io.to(`conversation:${conversationId}`).emit("message:seen", result);
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
        io.to(`order:${orderId}`).emit("order:location", location);
        callback?.({ success: true, data: location });
      } catch (error: any) {
        callback?.({ success: false, message: error.message });
      }
    });
  });

  return io;
};
