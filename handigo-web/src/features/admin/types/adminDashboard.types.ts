export interface AdminUserPresence {
  totalRegisteredUsers: number;
  onlineUsers: number | null;
  newUsersLast7Days?: number;
  asOf: string;
}

export interface AdminPendingCounts {
  applications: number;
  support: number;
  complaints: number;
  suggestions: number;
  withdrawals: number;
  withdrawalAmount: number;
  attentionOrders: number;
  reports: number;
  refunds: number;
  asOf: string;
}

export interface AdminMonthlyTrend {
  fromDate: string;
  toDate: string;
  points: Array<{ month: string; orders: number; platformRevenue: number }>;
}

export interface DashboardComparison {
  current: number;
  previous: number;
  changePercent: number | null;
}

export interface DashboardRatingSummary {
  averageRating: number;
  ratedOrders: number;
  fiveStar: number;
  fourToFive: number;
  belowFour: number;
  belowThree: number;
  belowTwo: number;
}

export interface DashboardRatingStats {
  current: DashboardRatingSummary;
  previous: DashboardRatingSummary;
  changePercent: number | null;
}

export interface AdminDashboardInsights {
  monthlyComparison?: { orders: DashboardComparison; platformRevenue: DashboardComparison };
  asOf: string;
  period: { fromDate: string; toDate: string; previousFromDate: string; previousToDate: string };
  pendingWork: { applications: number; support: number; complaints: number; suggestions: number; withdrawals: number; withdrawalAmount: number };
  attentionOrders: {
    awaitingProvider: number; lateArrival: number; overdue: number;
    items: Array<{ id: string; orderCode: string; status: string; expectedAt: string | null; createdAt: string }>;
  };
  comparison: {
    orders: DashboardComparison;
    platformRevenue: DashboardComparison;
    cancellationRate: { current: number; previous: number; changePoints: number };
  };
  customers: { newCustomers: number; bookingCustomers: number; returningCustomers: number };
  deposits: { heldAmount: number; heldCount: number; receivedAmount: number; refundedAmount: number; compensatedAmount: number; pendingRefundAmount: number };
  quality: { totalRatings: number; lowRatings: number; providers: Array<{ userId: string; fullName: string; complaintCount: number }>; ratingStats?: DashboardRatingStats };
}
