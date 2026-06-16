import { Router } from "express";
import {
  getMyNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
  sendSystemNotification,
} from "../controllers/notification.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";

const notificationRoutes = Router();

notificationRoutes.use(authMiddleware);
notificationRoutes.get("/", getMyNotifications);
notificationRoutes.get("/unread-count", getUnreadCount);
notificationRoutes.patch("/read-all", markAllAsRead);
notificationRoutes.patch("/:id/read", markAsRead);
notificationRoutes.post(
  "/send",
  roleMiddleware("ADMIN"),
  sendSystemNotification,
);

export default notificationRoutes;
