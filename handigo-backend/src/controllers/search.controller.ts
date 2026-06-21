import { NextFunction, Request, Response } from "express";
import { searchCatalog } from "../services/search.service";
import type { SearchQuery } from "../validations/search.validator";

export const search = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await searchCatalog(req.query as unknown as SearchQuery);
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
