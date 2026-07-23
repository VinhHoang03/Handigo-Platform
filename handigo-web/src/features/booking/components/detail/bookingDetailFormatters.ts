import type { Order, OrderQuotation } from "@/types/booking";
import { getOrderStatusMeta } from "@/utils/orderStatus";
import { toneChipClasses, toneTextClasses } from "@/utils/statusTone";

export const getStatusLabel = (status: string) => getOrderStatusMeta(status).label;

export const getPaymentMethodLabel = (method: string) => {
  switch (method) {
    case "wallet":
      return "Ví HandiGo";
    case "bank":
      return "Chuyển khoản";
    case "cash":
      return "Tiền mặt";
    default:
      return method;
  }
};

export const formatCurrency = (amount?: number | null) =>
  `${(typeof amount === "number" && Number.isFinite(amount) ? amount : 0).toLocaleString("vi-VN")}đ`;

export type PaymentStatusDisplay = { label: string; className: string };

export const getPaymentStatusDisplay = (
  currentOrder: Order,
  hasPaidInitialPayment: boolean,
): PaymentStatusDisplay => {
  const isFlexiblePrice =
    currentOrder.serviceId?.serviceType !== "fixed_price";

  if (currentOrder.status === "cancelled") {
    if (currentOrder.paymentStatus === "refunded") {
      const refundPolicy = currentOrder.cancellation?.refundPolicy;
      return {
        label:
          refundPolicy && refundPolicy.paidAmount > refundPolicy.refundAmount
            ? `Đã hoàn ${formatCurrency(refundPolicy.refundAmount)} (${refundPolicy.refundRate}%)`
            : "Đã hoàn tiền",
        className: toneTextClasses.success,
      };
    }

    if (
      currentOrder.paymentStatus === "paid" ||
      currentOrder.paymentStatus === "partially_paid"
    ) {
      return {
        label: "Đang xử lý hoàn tiền",
        className: toneTextClasses.warning,
      };
    }

    return {
      label: "Đã hủy, chưa phát sinh thanh toán",
      className: toneTextClasses.neutral,
    };
  }

  if (currentOrder.paymentStatus === "refunded") {
    return {
      label: "Đã hoàn tiền",
      className: toneTextClasses.success,
    };
  }

  if (currentOrder.inspectionRequired && hasPaidInitialPayment) {
    return {
      label: "Đã thanh toán tiền cọc",
      className: toneTextClasses.success,
    };
  }

  if (currentOrder.paymentStatus === "paid") {
    return {
      label: "Đã thanh toán",
      className: toneTextClasses.success,
    };
  }

  if (currentOrder.paymentStatus === "partially_paid") {
    return {
      label: "Đã thanh toán một phần",
      className: toneTextClasses.warning,
    };
  }

  if (hasPaidInitialPayment) {
    return {
      label: "Đã thanh toán",
      className: toneTextClasses.success,
    };
  }

  if (isFlexiblePrice) {
    return {
      label: "Chờ báo giá",
      className: toneTextClasses.warning,
    };
  }

  if (currentOrder.paymentMethod === "cash") {
    return {
      label: "Thanh toán sau khi hoàn thành",
      className: toneTextClasses.neutral,
    };
  }

  return { label: "Chờ thanh toán", className: toneTextClasses.brand };
};

export const getQuotationStatusLabel = (
  status: OrderQuotation["quotation"]["status"],
) => {
  switch (status) {
    case "pending":
      return "Chờ xác nhận";
    case "approved":
      return "Đã đồng ý";
    case "rejected":
      return "Đã từ chối";
    case "expired":
      return "Đã hết hạn";
    case "cancelled":
      return "Đã hủy";
    default:
      return status;
  }
};

export const getQuotationStatusClass = (
  status: OrderQuotation["quotation"]["status"],
) => {
  switch (status) {
    case "approved":
      return toneChipClasses.success;
    case "rejected":
    case "cancelled":
      return toneChipClasses.error;
    case "expired":
      return toneChipClasses.neutral;
    default:
      return toneChipClasses.warning + " animate-pulse";
  }
};
