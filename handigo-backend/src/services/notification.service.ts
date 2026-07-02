import { ClientSession, Types } from "mongoose";
import type { RequestUser } from "../middlewares/authContext";
import { Notification, INotification } from "../models/notification.model";
import User from "../models/user.model";
import { AppError } from "../utils/appError";
import { toObjectId } from "../utils/mongo";
import { emitToUser } from "../sockets/socketServer";
import type {
  AdminNotificationListQuery,
  NotificationListQuery,
  NotificationType,
  SendSystemNotificationInput,
} from "../validations/notification.validator";

type CreateNotificationInput = {
  userId: string | Types.ObjectId;
  type: NotificationType;
  title: string;
  content: string;
  data?: Record<string, unknown> | null;
};

const toNotificationResponse = (notification: INotification) => ({
  id: notification._id,
  userId: notification.userId,
  type: notification.type,
  title: notification.title,
  content: notification.content,
  data: notification.data ?? null,
  isRead: notification.isRead,
  readAt: notification.readAt ?? null,
  createdAt: notification.createdAt,
  updatedAt: notification.updatedAt,
});

const emitRealtimeNotification = (notification: INotification) => {
  emitToUser(
    notification.userId.toString(),
    "notification:new",
    toNotificationResponse(notification),
  );
};

const toAdminNotificationResponse = (notification: INotification) => {
  const base = toNotificationResponse(notification);
  const populatedUser = notification.userId as unknown as {
    _id?: Types.ObjectId;
    fullName?: string;
    email?: string;
    role?: string;
  };

  if (!populatedUser || !populatedUser._id) {
    return { ...base, recipient: null };
  }

  return {
    ...base,
    userId: populatedUser._id,
    recipient: {
      id: populatedUser._id,
      fullName: populatedUser.fullName,
      email: populatedUser.email,
      role: populatedUser.role,
    },
  };
};

const ensureAdmin = (user: RequestUser) => {
  if (user.role !== "ADMIN") {
    throw new AppError("Chỉ quản trị viên mới có thể gửi thông báo hệ thống", 403);
  }
};

export const createNotificationRecord = async (
  input: CreateNotificationInput,
  options?: {
    session?: ClientSession;
    emitRealtime?: boolean;
  },
) => {
  const [notification] = await Notification.create(
    [
      {
        userId: toObjectId(input.userId),
        type: input.type,
        title: input.title.trim(),
        content: input.content.trim(),
        data: input.data ?? null,
      },
    ],
    { session: options?.session },
  );

  if (options?.emitRealtime) {
    emitRealtimeNotification(notification);
  }

  return notification;
};

export const createNotification = async (input: CreateNotificationInput) => {
  const notification = await createNotificationRecord(input);

  return toNotificationResponse(notification);
};

export const getMyNotifications = async (user: RequestUser, query: NotificationListQuery) => {
  const filter: Record<string, unknown> = {
    userId: toObjectId(user.id),
    isDeleted: false,
  };

  if (query.isRead !== undefined) {
    filter.isRead = query.isRead;
  }

  if (query.type) {
    filter.type = query.type;
  }

  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
    Notification.countDocuments(filter),
  ]);

  return {
    items: items.map(toNotificationResponse),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const getAdminNotifications = async (
  admin: RequestUser,
  query: AdminNotificationListQuery,
) => {
  ensureAdmin(admin);

  const filter: Record<string, unknown> = {
    isDeleted: false,
  };

  if (query.isRead !== undefined) {
    filter.isRead = query.isRead;
  }

  if (query.type) {
    filter.type = query.type;
  }

  if (query.targetRole && query.targetRole !== "ALL") {
    const users = await User.find({
      role: query.targetRole,
      isDeleted: false,
    }).select("_id");
    filter.userId = { $in: users.map((user) => user._id) };
  }

  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    Notification.find(filter)
      .populate("userId", "fullName email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit),
    Notification.countDocuments(filter),
  ]);

  return {
    items: items.map(toAdminNotificationResponse),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const getUnreadCount = async (user: RequestUser) => {
  const count = await Notification.countDocuments({
    userId: toObjectId(user.id),
    isRead: false,
    isDeleted: false,
  });

  return { count };
};

export const markAsRead = async (user: RequestUser, notificationId: string) => {
  const notification = await Notification.findOne({
    _id: notificationId,
    userId: toObjectId(user.id),
    isDeleted: false,
  });

  if (!notification) {
    throw new AppError("Không tìm thấy thông báo", 404);
  }

  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
  }

  return toNotificationResponse(notification);
};

export const markAllAsRead = async (user: RequestUser) => {
  const now = new Date();
  const result = await Notification.updateMany(
    {
      userId: toObjectId(user.id),
      isRead: false,
      isDeleted: false,
    },
    {
      $set: {
        isRead: true,
        readAt: now,
      },
    },
  );

  return { modifiedCount: result.modifiedCount };
};

export const sendSystemNotification = async (
  admin: RequestUser,
  input: SendSystemNotificationInput,
) => {
  ensureAdmin(admin);

  const userFilter: Record<string, unknown> = {
    isDeleted: false,
  };

  if (input.targetRole !== "ALL") {
    userFilter.role = input.targetRole;
  }

  const users = await User.find(userFilter).select("_id");

  if (users.length === 0) {
    return {
      targetRole: input.targetRole,
      sentCount: 0,
    };
  }

  const notifications = users.map((user) => ({
    userId: user._id,
    type: input.type,
    title: input.title,
    content: input.content,
    data: input.data ?? null,
  }));

  const createdNotifications = await Notification.insertMany(notifications, { ordered: false });
  createdNotifications.forEach(emitRealtimeNotification);

  return {
    targetRole: input.targetRole,
    sentCount: notifications.length,
  };
};
