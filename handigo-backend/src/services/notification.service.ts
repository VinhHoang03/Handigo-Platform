import { Types } from "mongoose";
import { Notification, INotification } from "../models/notification.model";
import User from "../models/user.model";
import { AppError } from "../utils/appError";
import type {
  NotificationListQuery,
  NotificationType,
  SendSystemNotificationInput,
} from "../validations/notification.validator";

type RequestUser = {
  id: string;
  role: string;
};

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

const ensureObjectId = (id: string | Types.ObjectId) =>
  typeof id === "string" ? new Types.ObjectId(id) : id;

const ensureAdmin = (user: RequestUser) => {
  if (user.role !== "ADMIN") {
    throw new AppError("Only admin can send system notifications", 403);
  }
};

export const createNotification = async (input: CreateNotificationInput) => {
  const notification = await Notification.create({
    userId: ensureObjectId(input.userId),
    type: input.type,
    title: input.title.trim(),
    content: input.content.trim(),
    data: input.data ?? null,
  });

  return toNotificationResponse(notification);
};

export const getMyNotifications = async (user: RequestUser, query: NotificationListQuery) => {
  const filter: Record<string, unknown> = {
    userId: new Types.ObjectId(user.id),
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

export const getUnreadCount = async (user: RequestUser) => {
  const count = await Notification.countDocuments({
    userId: new Types.ObjectId(user.id),
    isRead: false,
    isDeleted: false,
  });

  return { count };
};

export const markAsRead = async (user: RequestUser, notificationId: string) => {
  const notification = await Notification.findOne({
    _id: notificationId,
    userId: new Types.ObjectId(user.id),
    isDeleted: false,
  });

  if (!notification) {
    throw new AppError("Notification not found", 404);
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
      userId: new Types.ObjectId(user.id),
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

  await Notification.insertMany(notifications, { ordered: false });

  return {
    targetRole: input.targetRole,
    sentCount: notifications.length,
  };
};
