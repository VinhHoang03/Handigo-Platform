import type { Order, OrderCustomer } from "@/types/booking";

export const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export type RevenuePeriod = "week" | "month";

export const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getRevenueRange = (period: RevenuePeriod) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  let dayCount = 7;

  if (period === "week") {
    const daysSinceMonday = (today.getDay() + 6) % 7;
    start.setDate(today.getDate() - daysSinceMonday);
  } else {
    start.setDate(1);
    dayCount = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  }

  const dates = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });

  return {
    dates,
    label:
      period === "week"
        ? `${dates[0].toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })} - ${dates[dates.length - 1].toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}`
        : `Tháng ${today.getMonth() + 1}/${today.getFullYear()}`,
  };
};

export const getOrderDate = (order: Order) =>
  new Date(order.scheduledAt || order.createdAt);

export function getCustomer(order: Order): OrderCustomer | null {
  return typeof order.customerId === "object" ? order.customerId : null;
}

export function formatMoney(value?: number) {
  return currencyFormatter.format(value ?? 0);
}

export function formatDateTime(value?: string | null) {
  if (!value) return "Chưa chọn thời gian";

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

export function shortAddress(order: Order) {
  const address = order.addressId;
  if (!address) return "";

  const fullAddress = (address as { fullAddress?: string }).fullAddress?.trim();
  if (fullAddress) {
    return fullAddress;
  }

  return [
    address.detailAddress,
    address.ward,
    address.district,
    address.province,
  ]
    .filter(Boolean)
    .join(", ");
}

export function getOrderLoadError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response
  ) {
    const data = error.response.data as { message?: string; error?: string };
    if (data.message === "Route not found") {
      return "Backend chưa nhận route /orders/provider/recent. Hãy restart backend rồi thử lại.";
    }
    if (data.message || data.error) {
      return data.message || data.error || "Không thể tải booking gần nhất.";
    }
  }

  return "Không thể tải booking gần nhất.";
}
