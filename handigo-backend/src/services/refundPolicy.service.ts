import { DEFAULT_REFUND_POLICY, type RefundPolicy } from "../validations/refundPolicy.validator";

export const REFUND_POLICY_VERSION = "HANDIGO_REFUND_V1";
export const QUOTATION_DEPOSIT_POLICY_VERSION = "HANDIGO_QUOTATION_DEPOSIT_V1";
export const QUOTATION_DECLINED_REASON = "Khách hàng không đồng ý báo giá";
export const isQuotationDeclinedReason = (reason = "") =>
  reason.trim() === QUOTATION_DECLINED_REASON || reason.trim().startsWith(`${QUOTATION_DECLINED_REASON}:`);

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
  hasRepairQuotation?: boolean;
  inspectionRequired?: boolean;
  paidInspectionDeposit?: number;
  cancellationReason?: string;
}

export interface RefundPolicyResult {
  policyVersion: string;
  canCancel: boolean;
  refundRate: number;
  paidAmount: number;
  refundAmount: number;
  cancellationFee: number;
  providerCompensation: number;
  providerCompensationRate: number;
  platformRetainedAmount: number;
  hoursBeforeStart: number | null;
  policyReason: string;
}

const roundMoney = (amount: number) => Math.max(0, Math.round(amount));

export const calculateRefundPolicy = (
  input: RefundPolicyInput,
  policy: RefundPolicy = DEFAULT_REFUND_POLICY,
): RefundPolicyResult => {
  const paidAmount = roundMoney(input.paidAmount);
  const now = input.now || new Date();
  const hoursBeforeStart = input.scheduledAt
    ? (input.scheduledAt.getTime() - now.getTime()) / 3_600_000
    : null;

  const canCancel = ["created", "accepted"].includes(input.orderStatus);
  if (canCancel && input.inspectionRequired && input.orderStatus === "accepted"
    && input.hasAssignedProvider && (input.role === "customer"
      || (input.role === "provider" && input.hasRepairQuotation))) {
    const deposit = Math.min(paidAmount, roundMoney(input.paidInspectionDeposit || 0));
    const refundAmount = paidAmount - deposit;
    return {
      policyVersion: QUOTATION_DEPOSIT_POLICY_VERSION,
      canCancel: true,
      refundRate: paidAmount ? refundAmount / paidAmount * 100 : 100,
      paidAmount, refundAmount, cancellationFee: deposit,
      providerCompensation: deposit, providerCompensationRate: 100, platformRetainedAmount: 0,
      hoursBeforeStart,
      policyReason: input.hasRepairQuotation
        ? "Hủy sau khi thợ đã báo giá: tiền cọc thực trả được chuyển vào ví thợ; khoản thanh toán thêm được hoàn cho khách."
        : "Khách hủy sau khi thợ đã nhận đơn: tiền cọc thực trả được chuyển vào ví thợ; khoản thanh toán thêm được hoàn cho khách.",
    };
  }

  if (input.inspectionRequired && ["customer", "provider"].includes(input.role)) {
    return {
      policyVersion: REFUND_POLICY_VERSION, canCancel, refundRate: canCancel ? 100 : 0,
      paidAmount, refundAmount: canCancel ? paidAmount : 0, cancellationFee: canCancel ? 0 : paidAmount,
      providerCompensation: 0, providerCompensationRate: 0,
      platformRetainedAmount: canCancel ? 0 : paidAmount, hoursBeforeStart,
      policyReason: canCancel
        ? "Đơn báo giá chưa có thợ nhận hoặc đang tìm thợ thay thế: hoàn toàn bộ tiền đã thanh toán cho khách."
        : "Không thể hủy đơn đã bắt đầu thực hiện hoặc đã kết thúc.",
    };
  }

  let allowed = canCancel;
  let refundRate = 100;
  let policyReason = "Hoàn toàn bộ tiền đã thanh toán.";

  if (input.role !== "customer") {
    policyReason = "Provider, quản trị viên hoặc hệ thống hủy đơn.";
  } else if (!input.hasAssignedProvider || input.orderStatus === "created") {
    policyReason = "Đơn chưa có provider nhận.";
  } else if (["normal", "urgent"].includes(input.orderType)) {
    refundRate = policy.normalRefundPercent;
    policyReason = "Khách hàng hủy đơn sau khi provider đã nhận.";
  } else if (hoursBeforeStart === null) {
    refundRate = policy.missingScheduleRefundPercent;
    policyReason = `Lịch hẹn thiếu thời gian bắt đầu; áp dụng mức hoàn ${refundRate}%.`;
  } else if (hoursBeforeStart >= policy.earlyHours) {
    refundRate = policy.earlyRefundPercent;
    policyReason = `Hủy trước lịch ít nhất ${policy.earlyHours} giờ.`;
  } else if (hoursBeforeStart >= policy.middleHours) {
    refundRate = policy.middleRefundPercent;
    policyReason = `Hủy trong khoảng từ ${policy.middleHours} đến dưới ${policy.earlyHours} giờ trước lịch.`;
  } else if (hoursBeforeStart >= policy.lateHours) {
    refundRate = policy.lateRefundPercent;
    policyReason = `Hủy trong khoảng từ ${policy.lateHours} đến dưới ${policy.middleHours} giờ trước lịch.`;
  } else if (hoursBeforeStart > 0) {
    refundRate = policy.lastMinuteRefundPercent;
    policyReason = `Hủy dưới ${policy.lateHours} giờ trước lịch.`;
  } else {
    allowed = false;
    refundRate = 0;
    policyReason = "Lịch đã đến giờ thực hiện; vui lòng gửi yêu cầu hỗ trợ.";
  }

  if (!allowed) {
    refundRate = 0;
  }

  const refundAmount = roundMoney((paidAmount * refundRate) / 100);
  const cancellationFee = paidAmount - refundAmount;
  const providerCompensationRate = input.role === "customer" && input.hasAssignedProvider
    ? policy.providerCompensationPercent : 0;
  const providerCompensation = roundMoney(cancellationFee * providerCompensationRate / 100);
  const platformRetainedAmount = cancellationFee - providerCompensation;

  return {
    policyVersion: REFUND_POLICY_VERSION,
    canCancel: allowed,
    refundRate,
    paidAmount,
    refundAmount,
    cancellationFee,
    providerCompensation,
    providerCompensationRate,
    platformRetainedAmount,
    hoursBeforeStart,
    policyReason,
  };
};
