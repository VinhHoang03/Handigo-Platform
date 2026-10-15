export const REFUND_POLICY_VERSION = "HANDIGO_REFUND_V1";
export const CUSTOMER_CANCELLATION_POLICY_VERSION = "HANDIGO_CUSTOMER_CANCEL_5M_V1";
export const CUSTOMER_CANCELLATION_WINDOW_MS = 5 * 60 * 1000;
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
  providerAcceptedAt?: Date | null;
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

  if (input.role === "provider" && input.orderStatus === "accepted"
    && input.hasAssignedProvider && input.inspectionRequired
    && (!input.hasRepairQuotation || isQuotationDeclinedReason(input.cancellationReason))) {
    const deposit = Math.min(paidAmount, roundMoney(input.paidInspectionDeposit || 0));
    const refundAmount = paidAmount - deposit;
    return {
      policyVersion: QUOTATION_DEPOSIT_POLICY_VERSION,
      canCancel: true,
      refundRate: paidAmount ? refundAmount / paidAmount * 100 : 100,
      paidAmount, refundAmount, cancellationFee: deposit,
      providerCompensation: deposit, platformRetainedAmount: 0,
      hoursBeforeStart,
      policyReason: "Thợ hủy tại giai đoạn trao đổi báo giá: tiền cọc được chuyển cho thợ; tiền sửa chữa đã thanh toán thêm được hoàn cho khách.",
    };
  }

  if (input.role === "customer" && input.orderStatus === "in_progress") {
    return {
      policyVersion: CUSTOMER_CANCELLATION_POLICY_VERSION,
      canCancel: false, refundRate: 0, paidAmount, refundAmount: 0,
      cancellationFee: 0, providerCompensation: 0, platformRetainedAmount: 0,
      hoursBeforeStart,
      policyReason: "Thợ đã bắt đầu làm việc, bạn không thể hủy đơn hàng.",
    };
  }

  if (input.role === "customer" && input.hasAssignedProvider
    && input.orderStatus === "accepted") {
    const acceptedAt = input.providerAcceptedAt?.getTime();
    const elapsed = acceptedAt === undefined ? NaN : now.getTime() - acceptedAt;
    const canCancel = Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= CUSTOMER_CANCELLATION_WINDOW_MS;
    return {
      policyVersion: CUSTOMER_CANCELLATION_POLICY_VERSION,
      canCancel, refundRate: canCancel ? 100 : 0, paidAmount,
      refundAmount: canCancel ? paidAmount : 0,
      cancellationFee: 0, providerCompensation: 0, platformRetainedAmount: 0,
      hoursBeforeStart,
      policyReason: canCancel
        ? "Hủy trong vòng 5 phút kể từ khi thợ nhận đơn, hoàn toàn bộ khoản đã thanh toán về ví Handigo."
        : "Đã hết thời hạn hủy 5 phút kể từ khi thợ nhận đơn hoặc chưa xác minh được thời điểm nhận đơn.",
    };
  }

  const canCancel = ["created", "accepted"].includes(input.orderStatus);
  let refundRate = 100;
  let policyReason = "Hoàn toàn bộ tiền đã thanh toán.";

  if (input.role !== "customer") {
    policyReason = "Provider, quản trị viên hoặc hệ thống hủy đơn.";
  } else if (!input.hasAssignedProvider || input.orderStatus === "created") {
    policyReason = "Đơn chưa có provider nhận.";
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
