import { NextFunction, Request, Response } from "express";
import { requireRequestUser } from "../middlewares/authContext";
import * as notificationService from "../services/notification.service";
import {
  adminNotificationListQuerySchema,
  notificationIdParamSchema,
  notificationListQuerySchema,
  sendSystemNotificationSchema,
} from "../validations/notification.validator";

export const getMyNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const query = notificationListQuerySchema.parse(req.query);
    const result = await notificationService.getMyNotifications(requireRequestUser(req), query);

    return res.json({
      success: true,
      data: result,
      message: "Get notifications successfully",
    });
  } catch (error) {
    return next(error);
  }
};

export const getUnreadCount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await notificationService.getUnreadCount(requireRequestUser(req));

    return res.json({
      success: true,
      data: result,
      message: "Get unread notification count successfully",
    });
  } catch (error) {
    return next(error);
  }
};

export const getAdminNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const query = adminNotificationListQuerySchema.parse(req.query);
    const result = await notificationService.getAdminNotifications(
      requireRequestUser(req),
      query,
    );

    return res.json({
      success: true,
      data: result,
      message: "Get admin notifications successfully",
    });
  } catch (error) {
    return next(error);
  }
};

export const markAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const params = notificationIdParamSchema.parse(req.params);
    const notification = await notificationService.markAsRead(
      requireRequestUser(req),
      params.id,
    );

    return res.json({
      success: true,
      data: notification,
      message: "Mark notification as read successfully",
    });
  } catch (error) {
    return next(error);
  }
};

export const markAllAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await notificationService.markAllAsRead(requireRequestUser(req));

    return res.json({
      success: true,
      data: result,
      message: "Mark all notifications as read successfully",
    });
  } catch (error) {
    return next(error);
  }
};

export const sendSystemNotification = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const body = sendSystemNotificationSchema.parse(req.body);
    const result = await notificationService.sendSystemNotification(
      requireRequestUser(req),
      body,
    );

    return res.status(201).json({
      success: true,
      data: result,
      message: "Send system notification successfully",
    });
  } catch (error) {
    return next(error);
  }
};
