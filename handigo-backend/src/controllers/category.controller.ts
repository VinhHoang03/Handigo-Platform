import { Request, Response } from "express";
import * as categoryService from "../services/category.service";

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
