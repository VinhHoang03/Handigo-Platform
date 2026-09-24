import type { StatusTone } from "@/utils/statusTone";
import type {
  PaymentMethod,
  PaymentStatus,
  PaymentType,
} from "../../types/adminOperations.types";

export const paymentMoney = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
});

export const paymentDateTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
});

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Chờ thanh toán",
  paid: "Đã thanh toán",
  failed: "Thất bại",
  refunded: "Đã hoàn tiền",
};

/**
 * Trước đây mọi trạng thái đều hiển thị bằng một màu thương hiệu duy nhất, nên
 * "Thất bại" trông giống hệt "Đã thanh toán". Quy về tông ngữ nghĩa dùng chung.
 */
export const PAYMENT_STATUS_TONES: Record<PaymentStatus, StatusTone> = {
  pending: "warning",
  paid: "success",
  failed: "error",
  refunded: "info",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  payos: "PayOS",
  vnpay: "VNPay",
  cash: "Tiền mặt",
  wallet: "Ví",
  bank: "Chuyển khoản",
};

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  full: "Thanh toán toàn bộ",
  remaining: "Thanh toán còn lại",
  inspection_deposit: "Đặt cọc khảo sát",
};

/** Các trạng thái hoàn tiền cho phép admin bấm thử lại. */
export const RETRYABLE_REFUND_STATUSES = ["failed", "manual_review", "retry_required"];
