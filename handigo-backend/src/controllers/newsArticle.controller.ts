import { NextFunction, Request, Response } from "express";
import * as newsArticleService from "../services/newsArticle.service";
import { requireAuthenticatedUser } from "../middlewares/authContext";

export const listPublished = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await newsArticleService.listPublishedArticles(req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getPublished = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await newsArticleService.getPublishedArticle(
      req.params.slug as string,
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const listAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await newsArticleService.listAdminArticles(req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const create = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await newsArticleService.createArticle(
      requireAuthenticatedUser(req).id,
      req.body,
    );
    res.status(201).json({
      success: true,
      data,
      message: "Đã tạo bài viết",
    });
  } catch (error) {
    next(error);
  }
};

export const update = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await newsArticleService.updateArticle(
      req.params.id as string,
      req.body,
    );
    res.json({ success: true, data, message: "Đã cập nhật bài viết" });
  } catch (error) {
    next(error);
  }
};

export const remove = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await newsArticleService.deleteArticle(req.params.id as string);
    res.json({ success: true, data: null, message: "Đã xóa bài viết" });
  } catch (error) {
    next(error);
  }
};
