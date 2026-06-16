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
    const category = await categoryService.getCategoryById(
      req.params.id as string,
    );
    res.json({ success: true, data: category });
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

export const getActiveCategories = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const categories = await categoryService.getActiveCategories();
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

export const getCategories = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await categoryService.getCategories(req.query);
    res.json({ success: true, data: result });
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
    const category = await categoryService.updateCategory(
      req.params.id as string,
      req.body,
    );
    res.json({
      success: true,
      data: category,
      message: "Category updated successfully",
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
    res.json({
      success: true,
      data: null,
      message: "Category deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
