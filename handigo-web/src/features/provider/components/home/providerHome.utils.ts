import type { Order, OrderCustomer } from "@/types/booking";

export const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export type RevenuePeriod = "week" | "month" | "year" | "custom";

export interface RevenueCustomRange {
  fromDate: string;
  toDate: string;
}

export const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const localDate = (value: string) => new Date(`${value}T00:00:00`);

export const revenueWeekKey = (date: Date) => {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + 4 - (target.getDay() || 7));
  const yearStart = new Date(target.getFullYear(), 0, 1);
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${target.getFullYear()}-W${String(week).padStart(2, "0")}`;
};

const weekStartFromKey = (value: string) => {
  const match = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!match) return new Date();
  const year = Number(match[1]);
  const week = Number(match[2]);
  const januaryFourth = new Date(year, 0, 4);
  const monday = new Date(januaryFourth);
  monday.setDate(januaryFourth.getDate() - ((januaryFourth.getDay() + 6) % 7) + (week - 1) * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

export const getRevenueRange = (
  period: RevenuePeriod,
  selectedYear = new Date().getFullYear(),
  customRange?: RevenueCustomRange | null,
  selectedWeek = revenueWeekKey(new Date()),
  selectedMonth = dateKey(new Date()).slice(0, 7),
) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  let dayCount = 7;

  if (period === "week") {
    start.setTime(weekStartFromKey(selectedWeek).getTime());
  } else if (period === "month") {
    start.setTime(localDate(`${selectedMonth}-01`).getTime());
    dayCount = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  } else if (period === "year") {
    start.setFullYear(selectedYear, 0, 1);
    dayCount = 12;
  } else if (customRange) {
    const customStart = localDate(customRange.fromDate);
    const customEnd = localDate(customRange.toDate);
    start.setTime(customStart.getTime());
    dayCount = Math.max(1, Math.round((customEnd.getTime() - customStart.getTime()) / 86_400_000) + 1);
  }

  const dates = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(start);
    if (period === "year") {
      date.setMonth(index, 1);
    } else {
      date.setDate(start.getDate() + index);
    }
    return date;
  });

  const queryEnd = period === "year"
    ? new Date(selectedYear, 11, 31)
    : dates[dates.length - 1];

  return {
    dates,
    queryStart: dates[0],
    queryEnd,
    label:
      period === "week"
        ? `${dates[0].toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })} - ${dates[dates.length - 1].toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}`
        : period === "month"
          ? `Tháng ${dates[0].getMonth() + 1}/${dates[0].getFullYear()}`
          : period === "year"
            ? `Năm ${selectedYear}`
            : `${dates[0].toLocaleDateString("vi-VN")} - ${dates[dates.length - 1].toLocaleDateString("vi-VN")}`,
  };
};

/** Gộp doanh thu tháng theo tuần, chỉ tính các ngày nằm trong tháng. */
export function getRevenueChart(
  period: RevenuePeriod,
  dates: Date[],
  earningsByDay: ReadonlyMap<string, number>,
  earningsByMonth: ReadonlyMap<string, number>,
) {
  if (period === "week") {
    return dates.map((date) => ({
      key: dateKey(date),
      label: date.toLocaleDateString("vi-VN", { weekday: "short" }),
      fullLabel: date.toLocaleDateString("vi-VN"),
      amount: earningsByDay.get(dateKey(date)) ?? 0,
    }));
  }

  if (period === "year") {
    return dates.map((date) => {
      const monthKey = dateKey(date).slice(0, 7);
      return {
        key: monthKey,
        label: `T${date.getMonth() + 1}`,
        fullLabel: `Tháng ${date.getMonth() + 1}/${date.getFullYear()}`,
        amount: earningsByMonth.get(monthKey) ?? 0,
      };
    });
  }

  if (period === "custom") {
    if (dates.length <= 14) {
      return dates.map((date) => ({
        key: dateKey(date),
        label: date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
        fullLabel: date.toLocaleDateString("vi-VN"),
        amount: earningsByDay.get(dateKey(date)) ?? 0,
      }));
    }

    if (dates.length <= 93) {
      const weeks: { key: string; label: string; fullLabel: string; amount: number }[] = [];
      for (let index = 0; index < dates.length; index += 7) {
        const weekDates = dates.slice(index, index + 7);
        const start = weekDates[0];
        const end = weekDates[weekDates.length - 1];
        weeks.push({
          key: dateKey(start),
          label: `${start.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}`,
          fullLabel: `${start.toLocaleDateString("vi-VN")} - ${end.toLocaleDateString("vi-VN")}`,
          amount: weekDates.reduce((total, date) => total + (earningsByDay.get(dateKey(date)) ?? 0), 0),
        });
      }
      return weeks;
    }

    const months = new Map<string, Date>();
    dates.forEach((date) => {
      const monthKey = dateKey(date).slice(0, 7);
      if (!months.has(monthKey)) months.set(monthKey, date);
    });
    return Array.from(months, ([monthKey, date]) => ({
      key: monthKey,
      label: `${date.getMonth() + 1}/${String(date.getFullYear()).slice(-2)}`,
      fullLabel: `Tháng ${date.getMonth() + 1}/${date.getFullYear()}`,
      amount: earningsByMonth.get(monthKey) ?? 0,
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
