import { AppError } from "./appError";

const parseRedirectUrl = (value: string) => {
  let frontend: URL;
  try { frontend = new URL(value); }
  catch { throw new AppError("Địa chỉ frontend trả về từ PayOS không hợp lệ.", 400); }
  if (!["http:", "https:"].includes(frontend.protocol) || frontend.username || frontend.password) {
    throw new AppError("Địa chỉ frontend trả về từ PayOS không hợp lệ.", 400);
  }
  return frontend;
};

export const buildOrderPaymentRedirects = (orderId: string, frontendUrl: string,
  configured: { returnUrl?: string; cancelUrl?: string } = {}) => {
  const frontend = parseRedirectUrl(frontendUrl);
  const path = '/customer/bookings/result';
  const configuredUrl = (value: string | undefined, result: "success" | "cancel") => {
    const url = value?.trim() ? parseRedirectUrl(value.trim()) : new URL(path, frontend.origin);
    url.searchParams.set("orderId", orderId);
    url.searchParams.set("payos", result);
    return url.href;
  };
  return {
    returnUrl: configuredUrl(configured.returnUrl, "success"),
    cancelUrl: configuredUrl(configured.cancelUrl, "cancel"),
  };
};

export const buildPaymentReturnRelay = (result: "success" | "cancel", frontendUrl: string, query: Record<string, unknown>) => {
  const frontend = parseRedirectUrl(frontendUrl);
  const url = new URL('/customer/bookings/result', frontend.origin);
  for (const key of ["orderId", "orderCode", "status", "cancel", "code", "id", "payos"]) {
    if (typeof query[key] === "string") url.searchParams.set(key, query[key]);
  }
  url.searchParams.set('payos', result);
  return url.href;
};
