import type { AdminRevenue, RevenueQuery, RevenueSeriesPoint } from "../../types/adminRevenue.types";
import { chartCompactMoney, chartMoney, monthLabel as chartMonthLabel } from "@/components/common/chart";

/*
 * Ba định dạng dưới đây đã chuyển sang `components/common/chart/chart-format.ts`
 * để trục biểu đồ, tooltip và bảng dữ liệu ẩn dùng chung một cách hiển thị số.
 * Giữ re-export ở đây để các import cũ không phải sửa.
 */
export const money = chartMoney;
export const compactMoney = chartCompactMoney;

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

export const monthLabel = chartMonthLabel;

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
