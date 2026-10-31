import type { Order, OrderCustomer } from "@/types/booking";

export const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export type RevenuePeriod = "week" | "month" | "year";

export const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getRevenueToday = () => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};

export const getRevenueRange = (period: RevenuePeriod, anchor = getRevenueToday()) => {
  const today = new Date(`${anchor}T00:00:00`);
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  let dayCount = 7;

  if (period === "week") {
    const daysSinceMonday = (today.getDay() + 6) % 7;
    start.setDate(today.getDate() - daysSinceMonday);
  } else if (period === "month") {
    start.setDate(1);
    dayCount = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  } else {
    start.setMonth(0, 1);
    dayCount = Math.round((new Date(today.getFullYear() + 1, 0, 1).getTime() - start.getTime()) / 86_400_000);
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
        ? `${dates[0].toLocaleDateString("vi-VN")} – ${dates[dates.length - 1].toLocaleDateString("vi-VN")}`
        : period === 'month' ? `Tháng ${today.getMonth() + 1}/${today.getFullYear()}` : `Năm ${today.getFullYear()}`,
  };
};

export function getRevenueSelection(period: RevenuePeriod, anchor: string): string {
  if (period === 'year') return anchor.slice(0, 4);
  if (period === 'month') return anchor.slice(0, 7);
  const date = new Date(`${anchor}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7));
  const year = date.getUTCFullYear();
  const week = Math.ceil(((date.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function parseRevenueSelection(period: RevenuePeriod, value: string): string | null {
  if (period === 'year') return /^\d{4}$/.test(value) && Number(value) >= 2025 ? `${value}-01-01` : null;
  if (period === 'month') return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) >= 2025 ? `${value}-01` : null;
  if (!/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(value) || Number(value.slice(0, 4)) < 2025) return null;
  const date = new Date(Number(value.slice(0, 4)), 0, 4);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7) + (Number(value.slice(-2)) - 1) * 7);
  const anchor = dateKey(date);
  return getRevenueSelection(period, anchor) === value ? anchor : null;
}

export function moveRevenuePeriod(period: RevenuePeriod, anchor: string, step: number): string {
  const start = new Date(getRevenueRange(period, anchor).dates[0]);
  if (period === 'week') start.setDate(start.getDate() + step * 7);
  else if (period === 'month') start.setMonth(start.getMonth() + step);
  else start.setFullYear(start.getFullYear() + step);
  return dateKey(start);
}

/** Gộp doanh thu tháng theo tuần, chỉ tính các ngày nằm trong tháng. */
export function getRevenueChart(
  period: RevenuePeriod,
  dates: Date[],
  earningsByDay: ReadonlyMap<string, number>,
) {
  if (period === "week") {
    return dates.map((date) => ({
      key: dateKey(date),
      label: date.toLocaleDateString("vi-VN", { weekday: "short" }),
      fullLabel: date.toLocaleDateString("vi-VN"),
      amount: earningsByDay.get(dateKey(date)) ?? 0,
    }));
  }

  if (period === 'year') {
    return Array.from({ length: 12 }, (_, month) => ({
      key: `${dates[0].getFullYear()}-${String(month + 1).padStart(2, '0')}`,
      label: `T${month + 1}`,
      fullLabel: `Tháng ${month + 1}/${dates[0].getFullYear()}`,
      amount: dates.filter(date => date.getMonth() === month)
        .reduce((total, date) => total + (earningsByDay.get(dateKey(date)) ?? 0), 0),
    }));
  }

  const weeks: { key: string; label: string; fullLabel: string; amount: number }[] = [];
  for (let index = 0; index < dates.length;) {
    const start = dates[index];
    const daysInWeek = 7 - ((start.getDay() + 6) % 7);
    const weekDates = dates.slice(index, index + daysInWeek);
    const end = weekDates[weekDates.length - 1];
    const label = `Tuần ${weeks.length + 1}`;
    weeks.push({
      key: dateKey(start),
      label,
      fullLabel: `${label} (${start.toLocaleDateString("vi-VN")} - ${end.toLocaleDateString("vi-VN")})`,
      amount: weekDates.reduce((total, date) => total + (earningsByDay.get(dateKey(date)) ?? 0), 0),
    });
    index += weekDates.length;
  }
  return weeks;
}

export const getOrderDate = (order: Order) =>
  new Date(order.scheduledAt || order.schedule?.expectedStartAt || order.createdAt);

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
