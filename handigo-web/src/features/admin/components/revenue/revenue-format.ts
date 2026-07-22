import type { AdminRevenue, RevenueQuery, RevenueSeriesPoint } from "../../types/adminRevenue.types";

export const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export const compactMoney = new Intl.NumberFormat("vi-VN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const toInputDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
};

export const createRange = (days: number): RevenueQuery => {
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days + 1);
  return { fromDate: toInputDate(fromDate), toDate: toInputDate(toDate) };
};

export const monthLabel = (value: string) => {
  const [year, month] = value.split("-");
  return "Tháng " + Number(month) + "/" + year;
};

export interface MonthlyRevenue {
  month: string;
  gross: number;
  platform: number;
  provider: number;
}

const amountByMonth = (points: RevenueSeriesPoint[]) =>
  new Map(points.map((point) => [point.month, point.amount]));

export const mergeMonthlyRevenue = (data: AdminRevenue): MonthlyRevenue[] => {
  const gross = amountByMonth(data.completedOrderRevenueByMonth);
  const platform = amountByMonth(data.platformFeeByMonth);
  const provider = amountByMonth(data.providerNetRevenueByMonth);
  const months = new Set(
    [
      ...data.completedOrderRevenueByMonth,
      ...data.platformFeeByMonth,
      ...data.providerNetRevenueByMonth,
    ]
      .map((point) => point.month)
      .filter((month): month is string => Boolean(month)),
  );

  return [...months].sort().map((month) => ({
    month,
    gross: gross.get(month) ?? 0,
    platform: platform.get(month) ?? 0,
    provider: provider.get(month) ?? 0,
  }));
};
