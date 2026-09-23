import type { NotificationType } from "../types/notification.types";
import { Banknote, FileSpreadsheet, type LucideIcon, Megaphone, ReceiptText, Tag, Wallet } from "lucide-react";

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
export const notificationTypeIcons: Record<NotificationType, LucideIcon> = {
  ORDER: ReceiptText,
  PAYMENT: Banknote,
  QUOTATION: FileSpreadsheet,
  WITHDRAWAL: Wallet,
  PROMOTION: Tag,
  SYSTEM: Megaphone,
};
