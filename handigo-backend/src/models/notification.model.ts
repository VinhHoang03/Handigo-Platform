import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";
import { emitToUser } from "../sockets/socketServer";

export interface INotification extends Document, IBaseDocument {
  userId: Types.ObjectId;
  type: string;
  title: string;
  content: string;
  data?: Record<string, unknown> | null;
  isRead: boolean;
  readAt?: Date | null;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    data: { type: Schema.Types.Mixed, default: null },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    ...baseFields,
  },
  { timestamps: true },
);

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

const toRealtimeNotification = (notification: INotification) => ({
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
    toRealtimeNotification(notification),
  );
};

NotificationSchema.pre("save", function () {
  this.$locals.wasNew = this.isNew;
});

NotificationSchema.post("save", (notification: INotification) => {
  if (notification.$locals.wasNew) {
    emitRealtimeNotification(notification);
  }
});

export const Notification = model<INotification>("Notification", NotificationSchema, "notifications");
