import { Request, Response } from "express";
import { requireAuthenticatedUser } from "../middlewares/authContext";
import * as feedbackService from "../services/feedback.service";
import { sendControllerError } from "../utils/controllerError";
import * as moderationService from "../services/feedbackModeration.service";
import { moderationListSchema, moderationReviewSchema, moderationReportQuerySchema } from "../validations/feedback.validator";
import { getFeedbackModerationReport } from "../services/feedbackModerationReport.service";

const getUserId = (req: Request) => requireAuthenticatedUser(req).id;

export const getModerationReport = async (req: Request, res: Response) => {
  try {
    const result = await getFeedbackModerationReport(moderationReportQuerySchema.parse(req.query));
    return res.json({ success: true, data: result });
  } catch (error: unknown) { return sendControllerError(res, error); }
};

export const listModeration = async (req: Request, res: Response) => {
  try {
    const { page, limit, resourceId, kind } = moderationListSchema.parse(req.query);
    const user = requireAuthenticatedUser(req);
    const result = await moderationService.listFeedbackModeration(page, limit, user.role === "ADMIN" ? undefined : user.id, resourceId, kind);
    return res.json({ success: true, data: result });
  } catch (error: unknown) { return sendControllerError(res, error); }
};

export const reviewModeration = async (req: Request, res: Response) => {
  try {
    const { status } = moderationReviewSchema.parse(req.body);
    const result = await moderationService.reviewFeedbackModeration(req.params.id as string, getUserId(req), status);
    return res.json({ success: true, data: result });
  } catch (error: unknown) { return sendControllerError(res, error); }
};

export const getServiceFeedbacks = async (req: Request, res: Response) => {
  try {
    const data = await feedbackService.getServiceFeedbacks(req.params.id as string, req.query);
    return res.json({ success: true, data });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

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
      getUserId(req),
      req.body.expectedVersion,
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
