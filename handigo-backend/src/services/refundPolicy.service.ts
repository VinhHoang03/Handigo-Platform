import { DEFAULT_REFUND_POLICY, type RefundPolicy } from "../validations/refundPolicy.validator";
import type { IOrder } from "../models/order.model";

export const REFUND_POLICY_VERSION = "HANDIGO_REFUND_V1";
export const CUSTOMER_CANCELLATION_POLICY_VERSION = "HANDIGO_CUSTOMER_CANCEL_5M_V1";
export const CUSTOMER_CANCELLATION_WINDOW_MS = 5 * 60 * 1000;
export const QUOTATION_DEPOSIT_POLICY_VERSION = "HANDIGO_QUOTATION_DEPOSIT_V1";
export const PROVIDER_ARRIVAL_CANCELLATION_POLICY_VERSION = "HANDIGO_PROVIDER_ARRIVAL_CANCEL_V1";
export const PROVIDER_ARRIVAL_CANCELLATION_SUPPORT = 5_000;
export const hasProviderArrived = (order: Pick<IOrder, "providerId" | "arrival">) =>
  Boolean(order.providerId && order.arrival?.arrivedAt
    && order.arrival.providerId.toString() === order.providerId.toString());
export const QUOTATION_DECLINED_REASON = "Khách hàng không đồng ý báo giá";
export const isQuotationDeclinedReason = (reason = "") =>
  reason.trim() === QUOTATION_DECLINED_REASON || reason.trim().startsWith(`${QUOTATION_DECLINED_REASON}:`);

export type RefundPolicyRole = "customer" | "provider" | "admin";
// Đọc được lịch sử cũ để tính hoàn tiền, không mở lại các loại đơn đã ngừng dùng.
export type RefundPolicyOrderType = IOrder["orderType"];

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
  providerArrived?: boolean;
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
  if (input.role === "provider" && input.orderStatus === "accepted"
    && input.hasAssignedProvider && input.providerArrived) {
    const cancellationFee = Math.min(paidAmount, PROVIDER_ARRIVAL_CANCELLATION_SUPPORT);
    const refundAmount = paidAmount - cancellationFee;
    return {
      policyVersion: PROVIDER_ARRIVAL_CANCELLATION_POLICY_VERSION,
      canCancel: true, refundRate: paidAmount ? refundAmount / paidAmount * 100 : 100,
      paidAmount, refundAmount, cancellationFee,
      providerCompensation: PROVIDER_ARRIVAL_CANCELLATION_SUPPORT,
      providerCompensationRate: 100, platformRetainedAmount: 0, hoursBeforeStart,
      policyReason: "Thợ hủy sau khi đã đến nơi: thợ nhận 5.000đ vào ví; tiền đã thanh toán được hoàn về ví khách sau khi trừ khoản hỗ trợ. Tiền mặt chưa thu do Handigo hỗ trợ. Không tìm thợ thay thế.",
    };
  }
  if (canCancel && input.inspectionRequired && input.orderStatus === "accepted"
    && input.hasAssignedProvider && input.role === "provider" && input.hasRepairQuotation) {
    const deposit = Math.min(paidAmount, roundMoney(input.paidInspectionDeposit || 0));
    const refundAmount = paidAmount - deposit;
    return {
      policyVersion: QUOTATION_DEPOSIT_POLICY_VERSION,
      canCancel: true,
      refundRate: paidAmount ? refundAmount / paidAmount * 100 : 100,
      paidAmount, refundAmount, cancellationFee: deposit,
      providerCompensation: deposit, providerCompensationRate: 100, platformRetainedAmount: 0,
      hoursBeforeStart,
      policyReason: "Thợ hủy sau khi đã báo giá: tiền cọc thực trả được chuyển vào ví thợ; khoản thanh toán thêm được hoàn cho khách.",
    };
  }

  if (input.role === "customer" && input.orderStatus === "in_progress") {
    return {
      policyVersion: CUSTOMER_CANCELLATION_POLICY_VERSION,
      canCancel: false, refundRate: 0, paidAmount, refundAmount: 0,
      cancellationFee: 0, providerCompensation: 0, providerCompensationRate: 0, platformRetainedAmount: 0,
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
      cancellationFee: 0, providerCompensation: 0, providerCompensationRate: 0, platformRetainedAmount: 0,
      hoursBeforeStart,
      policyReason: canCancel
        ? "Hủy trong vòng 5 phút kể từ khi thợ nhận đơn, hoàn toàn bộ khoản đã thanh toán về ví Handigo."
        : "Đã hết thời hạn hủy 5 phút kể từ khi thợ nhận đơn hoặc chưa xác minh được thời điểm nhận đơn.",
    };
  }

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
  const providerCompensationRate = input.role === "customer" && input.hasAssignedProvider
    ? policy.providerCompensationPercent : 0;
  const providerCompensation = roundMoney(cancellationFee * providerCompensationRate / 100);
  const platformRetainedAmount = cancellationFee - providerCompensation;

  return {
    policyVersion: REFUND_POLICY_VERSION,
    canCancel,
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
