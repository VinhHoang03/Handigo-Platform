import { Request, Response } from "express";
import * as feedbackService from "../services/feedback.service";

const getStatusCode = (error: any) => error.statusCode || 500;

export const createFeedback = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const feedback = await feedbackService.createFeedback(req.user.id, req.body);

    return res.status(201).json({
      success: true,
      data: feedback,
      message: "Feedback created successfully",
    });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateMyFeedback = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const feedback = await feedbackService.updateMyFeedback(
      req.user.id,
      req.params.id as string,
      req.body,
    );

    return res.json({
      success: true,
      data: feedback,
      message: "Feedback updated successfully",
    });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({
      success: false,
      message: error.message,
    });
  }
};

export const getMyFeedbacks = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const feedbacks = await feedbackService.getMyFeedbacks(req.user.id);

    return res.json({
      success: true,
      data: feedbacks,
      message: "Success",
    });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({
      success: false,
      message: error.message,
    });
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
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({
      success: false,
      message: error.message,
    });
  }
};

export const getMyProviderFeedbacks = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const result = await feedbackService.getMyProviderFeedbacks(
      req.user.id,
      req.query,
    );

    return res.json({
      success: true,
      data: result,
      message: "Success",
    });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({
      success: false,
      message: error.message,
    });
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
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({
      success: false,
      message: error.message,
    });
  }
};

export const getFeedbackByOrder = async (req: Request, res: Response) => {
  try {
    const feedback = await feedbackService.getFeedbackByOrder(
      req.user!.id,
      req.params.orderId as string,
    );
    return res.json({ success: true, data: feedback, message: "Success" });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({ success: false, message: error.message });
  }
};

export const getOrderFeedbackContext = async (req: Request, res: Response) => {
  try {
    const context = await feedbackService.getOrderFeedbackContext(
      req.user!.id,
      req.params.orderId as string,
    );
    return res.json({ success: true, data: context, message: "Success" });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({ success: false, message: error.message });
  }
};

export const upsertProviderReply = async (req: Request, res: Response) => {
  try {
    const feedback = await feedbackService.upsertProviderReply(
      req.user!.id,
      req.params.id as string,
      req.body.content,
    );
    return res.json({
      success: true,
      data: feedback,
      message: "Provider reply saved successfully",
    });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({ success: false, message: error.message });
  }
};

export const uploadFeedbackImages = async (_req: Request, res: Response) => {
  return res.status(201).json({
    success: true,
    data: res.locals.imageUrls,
    message: "Feedback images uploaded successfully",
  });
};
