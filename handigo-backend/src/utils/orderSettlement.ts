import type { IOrderPricing } from "../models/order.model";
import { calculateBookingSettlement } from "./bookingPolicy";

export function getOrderSettlement(
  pricing: IOrderPricing, inspectionRequired = false, customerPaidAmount = pricing.totalPaidAmount,
) {
  const originalAmount = pricing.bookingAmount ?? pricing.baseAmount ??
    customerPaidAmount + (pricing.voucherDiscountAmount ?? 0) + (pricing.promotionDiscountAmount ?? 0);
  const grossAmount = inspectionRequired ? customerPaidAmount : Math.max(originalAmount, customerPaidAmount);
  const settlement = calculateBookingSettlement(
    grossAmount, pricing.platformCommissionRate, inspectionRequired,
  );
  return {
    ...settlement,
    grossAmount,
    customerPaidAmount,
    platformDiscountAmount: grossAmount - customerPaidAmount,
  };
}

export function withPendingOrderSettlement<T extends {
  pricing?: IOrderPricing; inspectionRequired?: boolean; status?: string; paymentStatus?: string;
}>(order: T): T {
  const pending = ["created", "accepted", "in_progress"].includes(order.status ?? "") ||
    (order.status === "completed" && order.paymentStatus === "unpaid");
  if (!pending || !order.pricing || order.inspectionRequired) return order;
  const settlement = getOrderSettlement(order.pricing);
  return {
    ...order,
    pricing: {
      ...order.pricing,
      platformCommissionAmount: settlement.platformCommissionAmount,
      providerEarningAmount: settlement.providerEarningAmount,
    },
  };
}
