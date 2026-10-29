import { AppError } from "./appError";
import { isAllowedOrigin } from "../configs/cors";

const parseRedirectUrl = (value: string) => {
  let frontend: URL;
  try { frontend = new URL(value); }
  catch { throw new AppError("Địa chỉ frontend trả về từ PayOS không hợp lệ.", 400); }
  if (!["http:", "https:"].includes(frontend.protocol) || frontend.username || frontend.password) {
    throw new AppError("Địa chỉ frontend trả về từ PayOS không hợp lệ.", 400);
  }
  return frontend;
};

// Chỉ quay về origin ứng dụng được phép, ưu tiên đúng giao thức/cổng web đang mở.
export const resolvePaymentFrontendOrigin = (...candidates: Array<string | undefined>) => {
  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;
    try {
      const url = parseRedirectUrl(candidate.trim());
      if (isAllowedOrigin(url.origin)) return url.origin;
    } catch {
      // Thử địa chỉ dự phòng nếu giá trị này không phải URL hợp lệ.
    }
  }
  throw new AppError("Không xác định được địa chỉ web để quay lại sau thanh toán.", 400);
};

export const buildOrderPaymentRedirects = (orderId: string, frontendUrl: string,
  configured: { returnUrl?: string; cancelUrl?: string; clientCancelUrl?: string } = {}) => {
  const frontend = parseRedirectUrl(frontendUrl);
  const requestedCancel = configured.clientCancelUrl ? parseRedirectUrl(configured.clientCancelUrl) : undefined;
  const isLegacyQuickRebooking = requestedCancel?.origin === frontend.origin
    && /^\/customer\/bookings\/[a-f\d]{24}$/i.test(requestedCancel.pathname)
    && requestedCancel.searchParams.get('quickRebook') === '1';
  const quickRebookOrderId = isLegacyQuickRebooking ? requestedCancel.pathname.split('/').pop()
    : requestedCancel?.origin === frontend.origin && requestedCancel.pathname === '/customer/services'
      && /^[a-f\d]{24}$/i.test(requestedCancel.searchParams.get('quickRebook') ?? '')
    ? requestedCancel.searchParams.get('quickRebook') : undefined;
  const cancelPath = quickRebookOrderId ? '/customer/services'
    : requestedCancel?.origin === frontend.origin && requestedCancel.pathname === '/customer/bookings/new/payment'
    ? '/customer/bookings/new/payment'
    : `/customer/bookings/${orderId}`;
  const path = '/customer/bookings/result';
  const configuredUrl = (value: string | undefined, result: "success" | "cancel") => {
    const url = value?.trim() ? parseRedirectUrl(value.trim()) : new URL(path, frontend.origin);
    url.searchParams.set("orderId", orderId);
    url.searchParams.set("payos", result);
    url.searchParams.set("frontendOrigin", frontend.origin);
    return url.href;
  };
  const cancelUrl = new URL(`${cancelPath}?payos=cancel`, frontend.origin);
  if (quickRebookOrderId) cancelUrl.searchParams.set('quickRebook', quickRebookOrderId);
  return {
    returnUrl: configuredUrl(configured.returnUrl, "success"),
    // Hủy QR quay thẳng về web, tránh đi qua địa chỉ callback backend.
    cancelUrl: cancelUrl.href,
  };
};

export const buildPaymentReturnRelay = (result: "success" | "cancel", frontendUrl: string, query: Record<string, unknown>) => {
  const frontend = parseRedirectUrl(resolvePaymentFrontendOrigin(
    typeof query.frontendOrigin === "string" ? query.frontendOrigin : undefined, frontendUrl));
  const orderId = typeof query.orderId === "string" && /^[a-f\d]{24}$/i.test(query.orderId) ? query.orderId : undefined;
  const path = result === "cancel" && orderId ? `/customer/bookings/${orderId}` : '/customer/bookings/result';
  const url = new URL(path, frontend.origin);
  for (const key of ["orderId", "orderCode", "status", "cancel", "code", "id", "payos"]) {
    if (typeof query[key] === "string") url.searchParams.set(key, query[key]);
  }
  url.searchParams.set('payos', result);
  return url.href;
};
