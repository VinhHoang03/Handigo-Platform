import type { NotificationType } from "../types/notification.types";

/** Nhãn hiển thị tiếng Việt cho từng loại thông báo. */
export const notificationTypeLabels: Record<NotificationType, string> = {
  ORDER: "Đơn hàng",
  PAYMENT: "Thanh toán",
  QUOTATION: "Báo giá",
  WITHDRAWAL: "Rút tiền",
  PROMOTION: "Khuyến mãi",
  SYSTEM: "Hệ thống",
};

/** Icon Material Symbols tương ứng với từng loại thông báo. */
export const notificationTypeIcons: Record<NotificationType, string> = {
  ORDER: "receipt_long",
  PAYMENT: "payments",
  QUOTATION: "request_quote",
  WITHDRAWAL: "account_balance_wallet",
  PROMOTION: "local_offer",
  SYSTEM: "campaign",
};
