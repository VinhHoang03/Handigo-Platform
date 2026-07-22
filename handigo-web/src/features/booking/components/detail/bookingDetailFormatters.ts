import type { Order, OrderQuotation } from "@/types/booking";

export const getStatusLabel = (status: string) => {
  switch (status) {
    case "created":
      return "Chờ xử lý";
    case "accepted":
      return "Đã xác nhận";
    case "in_progress":
      return "Đang thực hiện";
    case "completed":
      return "Đã hoàn thành";
    case "cancelled":
      return "Đã hủy";
    default:
      return status;
  }
};

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
        className: "text-emerald-600",
      };
    }

    if (
      currentOrder.paymentStatus === "paid" ||
      currentOrder.paymentStatus === "partially_paid"
    ) {
      return {
        label: "Đang xử lý hoàn tiền",
        className: "text-amber-600",
      };
    }

    return {
      label: "Đã hủy, chưa phát sinh thanh toán",
      className: "text-on-surface-variant",
    };
  }

  if (currentOrder.paymentStatus === "refunded") {
    return {
      label: "Đã hoàn tiền",
      className: "text-emerald-600",
    };
  }

  if (currentOrder.inspectionRequired && hasPaidInitialPayment) {
    return {
      label: "Đã thanh toán tiền cọc",
      className: "text-emerald-600",
    };
  }

  if (currentOrder.paymentStatus === "paid") {
    return {
      label: "Đã thanh toán",
      className: "text-emerald-600",
    };
  }

  if (currentOrder.paymentStatus === "partially_paid") {
    return {
      label: "Đã thanh toán một phần",
      className: "text-amber-600",
    };
  }

  if (hasPaidInitialPayment) {
    return {
      label: "Đã thanh toán",
      className: "text-emerald-600",
    };
  }

  if (isFlexiblePrice) {
    return {
      label: "Chờ báo giá",
      className: "text-amber-600",
    };
  }

  if (currentOrder.paymentMethod === "cash") {
    return {
      label: "Thanh toán sau khi hoàn thành",
      className: "text-on-surface-variant",
    };
  }

  return { label: "Chờ thanh toán", className: "text-primary" };
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
      return "bg-emerald-100 text-emerald-700";
    case "rejected":
    case "cancelled":
      return "bg-red-100 text-red-700";
    case "expired":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-amber-100 text-amber-700 animate-pulse";
  }
};
