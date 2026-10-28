export interface AdminUserPresence {
  totalRegisteredUsers: number;
  onlineUsers: number | null;
  asOf: string;
}

export interface DashboardComparison {
  current: number;
  previous: number;
  changePercent: number | null;
}

export interface AdminDashboardInsights {
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
  quality: { totalRatings: number; lowRatings: number; providers: Array<{ userId: string; fullName: string; complaintCount: number }> };
}
