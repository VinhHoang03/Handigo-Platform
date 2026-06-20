import { NextFunction, Request, Response } from "express";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;
const requestsByUser = new Map<string, number[]>();

export const providerApplicationOcrRateLimit = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const userId = req.user!.id;
  const now = Date.now();
  const recentRequests = (requestsByUser.get(userId) || []).filter(
    (timestamp) => now - timestamp < WINDOW_MS,
  );

  if (recentRequests.length >= MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      message: "Bạn thao tác quá nhanh. Vui lòng chờ một phút rồi thử lại.",
    });
  }

  recentRequests.push(now);
  requestsByUser.set(userId, recentRequests);
  next();
};
