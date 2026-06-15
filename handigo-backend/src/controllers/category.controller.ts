import { NextFunction, Request, Response } from "express";
import * as categoryService from "../services/category.service";

export const listCategories = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await categoryService.listCategories(req.query);
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getCategoryById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await categoryService.getCategoryById(req.params.id as string);
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await categoryService.createCategory(req.body);
    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await categoryService.updateCategory(
      req.params.id as string,
      req.body,
    );
    return res.json({
      success: true,
      message: "Category updated successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await categoryService.deleteCategory(req.params.id as string);
    return res.json({
      success: true,
      message: "Category deleted successfully",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

export const getActiveCategories = async (_req: Request, res: Response) => {
  try {
    const categories = await categoryService.getActiveCategories();

    return res.json({
      success: true,
      data: categories,
      message: "Success",
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};
