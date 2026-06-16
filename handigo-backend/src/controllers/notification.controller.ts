import { NextFunction, Request, Response } from "express";
import * as notificationService from "../services/notification.service";
import { AppError } from "../utils/appError";
import {
  notificationIdParamSchema,
  notificationListQuerySchema,
  sendSystemNotificationSchema,
} from "../validations/notification.validator";

const getRequestUser = (req: Request) => {
  if (!req.user) {
    throw new AppError("Authentication is required", 401);
  }

  return {
    id: req.user.id,
    role: req.user.role,
  };
};

export const getMyNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const query = notificationListQuerySchema.parse(req.query);
    const result = await notificationService.getMyNotifications(getRequestUser(req), query);

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
    const result = await notificationService.getUnreadCount(getRequestUser(req));

    return res.json({
      success: true,
      data: result,
      message: "Get unread notification count successfully",
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
    const notification = await notificationService.markAsRead(getRequestUser(req), params.id);

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
    const result = await notificationService.markAllAsRead(getRequestUser(req));

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
      getRequestUser(req),
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
