import { Request, Response, NextFunction } from "express";
import * as serviceSuggestionService from "../services/serviceSuggestion.service";
import * as serviceSuggestionValidator from "../validations/serviceSuggestion.validator";
import { AppError } from "../utils/appError";

const getUserId = (req: Request) => {
  if (!req.user?.id) {
    throw new AppError("Bạn cần đăng nhập để thực hiện thao tác này", 401);
  }

  return req.user.id;
};

export const createSuggestion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = serviceSuggestionValidator.createServiceSuggestionSchema.parse(
      req.body,
    );
    const suggestion = await serviceSuggestionService.createServiceSuggestion(
      getUserId(req),
      data,
    );
    return res.status(201).json({
      success: true,
      message: "Gửi đề xuất thành công",
      data: suggestion,
    });
  } catch (error) {
    next(error);
  }
};

export const getSuggestions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const filter = serviceSuggestionValidator.listServiceSuggestionSchema.parse(
      req.query,
    );
    const result = await serviceSuggestionService.getServiceSuggestions(filter);
    return res.json({
      success: true,
      data: result.suggestions,
      total: result.total,
      page: filter.page,
      limit: filter.limit,
    });
  } catch (error) {
    next(error);
  }
};

export const getSuggestionById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const suggestion = await serviceSuggestionService.getServiceSuggestionById(
      String(req.params.id),
    );
    return res.json({
      success: true,
      data: suggestion,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSuggestionStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const suggestionId = String(req.params.id);
    const data = serviceSuggestionValidator.updateServiceSuggestionSchema.parse(
      req.body,
    );
    const suggestion = await serviceSuggestionService.updateServiceSuggestion(
      suggestionId,
      data,
      getUserId(req),
    );
    return res.json({
      success: true,
      message: "Cập nhật đề xuất thành công",
      data: suggestion,
    });
  } catch (error) {
    next(error);
  }
};
