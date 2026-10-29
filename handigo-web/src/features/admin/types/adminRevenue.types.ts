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

export interface RevenueServiceRow {
  serviceId: string | null; name: string; categoryName: string; revenue: number; completedOrders: number;
  current: number; previous: number; changePercent: number | null; share: number;
}
export interface AdminRevenueInsights {
  period: { fromDate: string; toDate: string; previousFromDate: string; previousToDate: string };
  totalServiceRevenue: number;
  services: RevenueServiceRow[];
  topServices: Array<Pick<RevenueServiceRow, 'serviceId' | 'name' | 'categoryName' | 'revenue' | 'completedOrders'>>;
  channels: Array<{ method: string; collected: number; refunded: number; net: number; count: number; share: number }>;
  behaviorRisks: { total: number; items: Array<{ userId: string; fullName: string; reports: number; confirmed: number; latestReportId: string; latestTitle: string; latestAt: string }> };
}
