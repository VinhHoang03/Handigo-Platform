import { NextFunction, Request, Response } from "express";

type RateLimitKeyGenerator = (req: Request) => string;

type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
  message: string;
  keyGenerator?: RateLimitKeyGenerator;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const getClientIp = (req: Request) =>
  req.ip || req.socket.remoteAddress || "unknown";

const getAuthenticatedUserOrIp = (req: Request) =>
  req.user?.id ? "user:" + req.user.id : "ip:" + getClientIp(req);

export const createRateLimit = ({
  windowMs,
  maxRequests,
  message,
  keyGenerator = getClientIp,
}: RateLimitOptions) => {
  const entries = new Map<string, RateLimitEntry>();
  let lastCleanupAt = Date.now();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();

    if (now - lastCleanupAt >= windowMs) {
      for (const [key, entry] of entries) {
        if (entry.resetAt <= now) entries.delete(key);
      }
      lastCleanupAt = now;
    }

    const key = keyGenerator(req);
    const currentEntry = entries.get(key);
    const entry =
      currentEntry && currentEntry.resetAt > now
        ? currentEntry
        : { count: 0, resetAt: now + windowMs };

    entry.count += 1;
    entries.set(key, entry);

    const remaining = Math.max(0, maxRequests - entry.count);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((entry.resetAt - now) / 1000),
    );

    res.setHeader("X-RateLimit-Limit", maxRequests.toString());
    res.setHeader("X-RateLimit-Remaining", remaining.toString());
    res.setHeader(
      "X-RateLimit-Reset",
      Math.ceil(entry.resetAt / 1000).toString(),
    );

    if (entry.count > maxRequests) {
      res.setHeader("Retry-After", retryAfterSeconds.toString());
      return res.status(429).json({
        success: false,
        message,
      });
    }

    next();
  };
};

const AUTH_RATE_LIMIT_MESSAGE =
  "Bạn đã thử quá nhiều lần. Vui lòng chờ trước khi thử lại.";
const RESOURCE_RATE_LIMIT_MESSAGE =
  "Bạn thao tác quá nhanh. Vui lòng chờ rồi thử lại.";

export const otpRateLimit = createRateLimit({
  windowMs: 10 * 60_000,
  maxRequests: 10,
  message: AUTH_RATE_LIMIT_MESSAGE,
});

export const authMessageRateLimit = createRateLimit({
  windowMs: 15 * 60_000,
  maxRequests: 5,
  message: AUTH_RATE_LIMIT_MESSAGE,
});

export const uploadRateLimit = createRateLimit({
  windowMs: 10 * 60_000,
  maxRequests: 20,
  message: RESOURCE_RATE_LIMIT_MESSAGE,
  keyGenerator: getAuthenticatedUserOrIp,
});

export const ocrRateLimit = createRateLimit({
  windowMs: 60_000,
  maxRequests: 10,
  message: RESOURCE_RATE_LIMIT_MESSAGE,
  keyGenerator: getAuthenticatedUserOrIp,
});

export const paymentRateLimit = createRateLimit({
  windowMs: 5 * 60_000,
  maxRequests: 10,
  message: RESOURCE_RATE_LIMIT_MESSAGE,
  keyGenerator: getAuthenticatedUserOrIp,
});

export const resourceIntensiveRateLimit = createRateLimit({
  windowMs: 60_000,
  maxRequests: 60,
  message: RESOURCE_RATE_LIMIT_MESSAGE,
  keyGenerator: getAuthenticatedUserOrIp,
});

export const chatbotRateLimit = createRateLimit({
  windowMs: 60_000,
  maxRequests: 10,
  message: "Bạn gửi tin nhắn quá nhanh. Vui lòng chờ rồi thử lại.",
  keyGenerator: getAuthenticatedUserOrIp,
});

export const routingRateLimit = createRateLimit({
  windowMs: 60_000,
  maxRequests: 10,
  message: RESOURCE_RATE_LIMIT_MESSAGE,
  keyGenerator: getAuthenticatedUserOrIp,
});

export const dispatchRateLimit = createRateLimit({
  windowMs: 10 * 60_000,
  maxRequests: 10,
  message: RESOURCE_RATE_LIMIT_MESSAGE,
  keyGenerator: getAuthenticatedUserOrIp,
});
