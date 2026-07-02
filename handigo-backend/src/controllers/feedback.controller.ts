import { Request, Response } from "express";
import { requireAuthenticatedUser } from "../middlewares/authContext";
import * as feedbackService from "../services/feedback.service";
import { sendControllerError } from "../utils/controllerError";

const getUserId = (req: Request) => requireAuthenticatedUser(req).id;

export const createFeedback = async (req: Request, res: Response) => {
  try {
    const feedback = await feedbackService.createFeedback(getUserId(req), req.body);

    return res.status(201).json({
      success: true,
      data: feedback,
      message: "Feedback created successfully",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const updateMyFeedback = async (req: Request, res: Response) => {
  try {
    const feedback = await feedbackService.updateMyFeedback(
      getUserId(req),
      req.params.id as string,
      req.body,
    );

    return res.json({
      success: true,
      data: feedback,
      message: "Feedback updated successfully",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getMyFeedbacks = async (req: Request, res: Response) => {
  try {
    const feedbacks = await feedbackService.getMyFeedbacks(getUserId(req));

    return res.json({
      success: true,
      data: feedbacks,
      message: "Success",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getProviderFeedbacks = async (req: Request, res: Response) => {
  try {
    const result = await feedbackService.getProviderFeedbacks(
      req.params.providerId as string,
      req.query,
    );

    return res.json({
      success: true,
      data: result,
      message: "Success",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getLatestPublicFeedbacks = async (_req: Request, res: Response) => {
  try {
    const data = await feedbackService.getLatestPublicFeedbacks();
    return res.json({ success: true, data });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getMyProviderFeedbacks = async (req: Request, res: Response) => {
  try {
    const result = await feedbackService.getMyProviderFeedbacks(
      getUserId(req),
      req.query,
    );

    return res.json({
      success: true,
      data: result,
      message: "Success",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const setFeedbackVisibility = async (req: Request, res: Response) => {
  try {
    const feedback = await feedbackService.setFeedbackVisibility(
      req.params.id as string,
      req.body.isVisible,
    );

    return res.json({
      success: true,
      data: feedback,
      message: "Feedback visibility updated successfully",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getFeedbackByOrder = async (req: Request, res: Response) => {
  try {
    const feedback = await feedbackService.getFeedbackByOrder(
      getUserId(req),
      req.params.orderId as string,
    );
    return res.json({ success: true, data: feedback, message: "Success" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getOrderFeedbackContext = async (req: Request, res: Response) => {
  try {
    const context = await feedbackService.getOrderFeedbackContext(
      getUserId(req),
      req.params.orderId as string,
    );
    return res.json({ success: true, data: context, message: "Success" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const upsertProviderReply = async (req: Request, res: Response) => {
  try {
    const feedback = await feedbackService.upsertProviderReply(
      getUserId(req),
      req.params.id as string,
      req.body.content,
      req.body.images,
    );
    return res.json({
      success: true,
      data: feedback,
      message: "Provider reply saved successfully",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getProviderFeedbackByOrder = async (
  req: Request,
  res: Response,
) => {
  try {
    const feedback = await feedbackService.getProviderFeedbackByOrder(
      getUserId(req),
      req.params.orderId as string,
    );
    return res.json({ success: true, data: feedback, message: "Success" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const uploadFeedbackImages = async (_req: Request, res: Response) => {
  return res.status(201).json({
    success: true,
    data: res.locals.imageUrls,
    message: "Đã tải ảnh đánh giá thành công.",
  });
};
