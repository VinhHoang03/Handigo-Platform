import { Banknote, Landmark, Wallet, type LucideIcon } from "lucide-react";
export type PendingAction = {
  type: "confirmQuotation" | "rejectQuotation" | "cancelOrder" | "cancelSeries";
  reason: string;
  additionalInfo?: string;
  error?: string;
};

export type InitialPaymentMethod = "PAYOS" | "WALLET" | "CASH";

export const initialPaymentMethods: Array<{
  value: InitialPaymentMethod;
  icon: LucideIcon;
  title: string;
  description: string;
}> = [
  {
    value: "PAYOS",
    icon: Landmark,
    title: "Chuyển khoản ngân hàng",
    description: "Thanh toán qua cổng PayOS",
  },
  {
    value: "WALLET",
    icon: Wallet,
    title: "Ví Handigo",
    description: "Thanh toán từ số dư ví",
  },
  {
    value: "CASH",
    icon: Banknote,
    title: "Tiền mặt",
    description: "Thanh toán trực tiếp cho chuyên gia",
  },
];

export const customerCancellationReasons = [
  "Không còn nhu cầu sử dụng dịch vụ",
  "Đặt nhầm dịch vụ hoặc thông tin",
  "Thời gian thực hiện không còn phù hợp",
  "Không liên hệ được với chuyên gia",
  "Chi phí không phù hợp",
  "Lý do khác",
];

export type ActionDialogConfig = {
  title: string;
  message: string;
  confirmLabel: string;
  tone: "primary" | "danger";
  requiresReason: boolean;
};

const actionDialogConfigs: Record<PendingAction["type"], ActionDialogConfig> = {
  confirmQuotation: {
    title: "Xác nhận báo giá",
    message:
      "Khi bạn đồng ý, chuyên gia có thể bắt đầu thực hiện công việc. Chi phí báo giá do bạn và chuyên gia tự thanh toán trực tiếp, không qua Handigo.",
    confirmLabel: "Đồng ý",
    tone: "primary",
    requiresReason: false,
  },
  rejectQuotation: {
    title: "Từ chối báo giá",
    message: "Nhập lý do từ chối để chuyển phản hồi cho chuyên gia.",
    confirmLabel: "Từ chối",
    tone: "danger",
    requiresReason: true,
  },
  cancelOrder: {
    title: "Hủy yêu cầu",
    message:
      "Nhập lý do hủy yêu cầu. Thao tác này sẽ cập nhật trạng thái đơn hàng thành đã hủy.",
    confirmLabel: "Hủy yêu cầu",
    tone: "danger",
    requiresReason: true,
  },
  cancelSeries: {
    title: "Hủy các buổi còn lại",
    message:
      "Buổi đang xem và tất cả buổi phía sau còn có thể hủy sẽ được hủy. Khoản đã thanh toán của từng buổi được xử lý theo chính sách hiện tại.",
    confirmLabel: "Hủy các buổi còn lại",
    tone: "danger",
    requiresReason: true,
  },
};

export const getActionDialogConfig = (
  type: PendingAction["type"],
): ActionDialogConfig => actionDialogConfigs[type];
