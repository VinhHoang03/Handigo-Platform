export const REFUND_POLICY_VERSION = "HANDIGO_REFUND_V1";

export type RefundPolicyRole = "customer" | "provider" | "admin";
export type RefundPolicyOrderType =
  | "normal"
  | "urgent"
  | "scheduled"
  | "recurring";

export interface RefundPolicyInput {
  role: RefundPolicyRole;
  orderType: RefundPolicyOrderType;
  orderStatus: "created" | "accepted" | "in_progress" | "completed" | "cancelled";
  scheduledAt?: Date | null;
  hasAssignedProvider: boolean;
  paidAmount: number;
  now?: Date;
}

export interface RefundPolicyResult {
  policyVersion: string;
  canCancel: boolean;
  refundRate: number;
  paidAmount: number;
  refundAmount: number;
  cancellationFee: number;
  providerCompensation: number;
  platformRetainedAmount: number;
  hoursBeforeStart: number | null;
  policyReason: string;
}

const roundMoney = (amount: number) => Math.max(0, Math.round(amount));

export const calculateRefundPolicy = (
  input: RefundPolicyInput,
): RefundPolicyResult => {
  const paidAmount = roundMoney(input.paidAmount);
  const now = input.now || new Date();
  const hoursBeforeStart = input.scheduledAt
    ? (input.scheduledAt.getTime() - now.getTime()) / 3_600_000
    : null;

  let canCancel = ["created", "accepted"].includes(input.orderStatus);
  let refundRate = 100;
  let policyReason = "Hoàn toàn bộ tiền đã thanh toán.";

  if (input.role !== "customer") {
    policyReason = "Provider, quản trị viên hoặc hệ thống hủy đơn.";
  } else if (!input.hasAssignedProvider || input.orderStatus === "created") {
    policyReason = "Đơn chưa có provider nhận.";
  } else if (["normal", "urgent"].includes(input.orderType)) {
    refundRate = 70;
    policyReason = "Khách hàng hủy đơn sau khi provider đã nhận.";
  } else if (hoursBeforeStart === null) {
    refundRate = 70;
    policyReason = "Lịch hẹn thiếu thời gian bắt đầu; áp dụng mức hoàn an toàn 70%.";
  } else if (hoursBeforeStart >= 24) {
    policyReason = "Hủy trước lịch ít nhất 24 giờ.";
  } else if (hoursBeforeStart >= 6) {
    refundRate = 80;
    policyReason = "Hủy trong khoảng từ 6 đến dưới 24 giờ trước lịch.";
  } else if (hoursBeforeStart >= 2) {
    refundRate = 50;
    policyReason = "Hủy trong khoảng từ 2 đến dưới 6 giờ trước lịch.";
  } else if (hoursBeforeStart > 0) {
    refundRate = 20;
    policyReason = "Hủy dưới 2 giờ trước lịch.";
  } else {
    canCancel = false;
    refundRate = 0;
    policyReason = "Lịch đã đến giờ thực hiện; vui lòng gửi yêu cầu hỗ trợ.";
  }

  if (!canCancel) {
    refundRate = 0;
  }

  const refundAmount = roundMoney((paidAmount * refundRate) / 100);
  const cancellationFee = paidAmount - refundAmount;
  const providerCompensation =
    input.role === "customer" && input.hasAssignedProvider
      ? roundMoney(cancellationFee * 0.8)
      : 0;
  const platformRetainedAmount = cancellationFee - providerCompensation;

  return {
    policyVersion: REFUND_POLICY_VERSION,
    canCancel,
    refundRate,
    paidAmount,
    refundAmount,
    cancellationFee,
    providerCompensation,
    platformRetainedAmount,
    hoursBeforeStart,
    policyReason,
  };
};
