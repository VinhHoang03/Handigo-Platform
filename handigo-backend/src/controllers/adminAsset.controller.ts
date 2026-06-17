import { Request, Response } from "express";

export const uploadImage = async (_req: Request, res: Response) => {
  return res.status(201).json({
    success: true,
    data: {
      url: res.locals.imageUrl,
    },
    message: "Image uploaded successfully",
  });
};
