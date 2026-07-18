export interface RevenueSeriesPoint {
  amount: number;
  count: number;
  day?: string;
  week?: string;
  month?: string;
}

export interface AdminRevenue {
  revenueByDay: RevenueSeriesPoint[];
  revenueByWeek: RevenueSeriesPoint[];
  revenueByMonth: RevenueSeriesPoint[];
  platformFeeRevenue: number;
  completedOrderRevenue: number;
  depositRevenue: number;
  platformFeeByMonth: RevenueSeriesPoint[];
  completedOrderRevenueByMonth: RevenueSeriesPoint[];
  depositRevenueByMonth: RevenueSeriesPoint[];
  collectedPaymentRevenue: number;
  refundedRevenue: number;
  netCollectedPaymentRevenue: number;
  providerNetRevenue: number;
  cashCompletedRevenue: number;
  onlineCompletedRevenue: number;
  providerNetRevenueByMonth: RevenueSeriesPoint[];
  collectedPaymentByDay: RevenueSeriesPoint[];
}

export interface RevenueQuery {
  fromDate: string;
  toDate: string;
}
