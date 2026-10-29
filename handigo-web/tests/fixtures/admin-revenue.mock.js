export const adminRevenueApi = {
  async getInsights(range) {
    window.__revenueInsightQueries ??= [];
    window.__revenueInsightQueries.push(range);
    return {
      period: { ...range, previousFromDate: '2026-09-01', previousToDate: '2026-09-30' }, totalServiceRevenue: 1000000,
      services: [{ serviceId: 's1', name: 'Vệ sinh điều hòa kiểm thử', categoryName: 'Điện lạnh', revenue: 1000000, completedOrders: 4, previous: 500000, current: 1000000, changePercent: 100, share: 100 }],
      topServices: [{ serviceId: 's1', name: 'Vệ sinh điều hòa kiểm thử', categoryName: 'Điện lạnh', revenue: 1000000, completedOrders: 4 }],
      channels: ['wallet', 'payos', 'cash'].map(method => ({ method, collected: 100000, refunded: 25000, net: 75000, share: 33.3, count: 1 })),
      behaviorRisks: { total: 1, items: [{ userId: '000000000000000000000001', fullName: 'Thợ cần xem xét', reports: 2, confirmed: 1, latestReportId: '000000000000000000000003', latestTitle: 'Báo cáo ứng xử kiểm thử', latestAt: '2026-10-01' }] },
    };
  },
  async getRevenue(range) {
  window.__reportQueries ??= [];
  window.__reportQueries.push(range);
  return {
    platformFeeRevenue: range.fromDate === '2026-09-01' ? 100000 : 150000,
    completedOrderRevenue: 1000000, providerNetRevenue: 850000, netCollectedPaymentRevenue: 175000,
    collectedPaymentRevenue: 200000, refundedRevenue: 25000, onlineCompletedRevenue: 1000000, cashCompletedRevenue: 0, depositRevenue: 50000,
    completedOrderRevenueByMonth: [], platformFeeByMonth: [], providerNetRevenueByMonth: [], collectedPaymentByDay: [],
  };
} };
export const adminOperationsApi = {
  async orderAnalytics(query) {
    window.__overviewQueries ??= [];
    window.__overviewQueries.push(query);
    return { ordersByStatus: [], ordersByServiceCategory: [], ordersByMonth: [], completionRate: 0, cancellationRate: 0 };
  },
  async providerAnalytics() { return { topProvidersByRevenue: [{ providerId: '000000000000000000000001', userId: '000000000000000000000002', fullName: 'Thợ xếp hạng kiểm thử', revenue: 850000, averageRating: 4.8, completedOrders: 10 }], topProvidersByCompletedOrders: [], totalProviders: 1, activeProviders: 1, onlineProviders: 0, averageProviderRating: 4.8 }; },
  async payments(query) {
    window.__paymentQueries ??= [];
    window.__paymentQueries.push(query);
    if (window.__failNextPayment) { window.__failNextPayment = false; throw new Error('Không tải được thanh toán kiểm thử.'); }
    return { items: [{ _id: '000000000000000000000001', orderId: '000000000000000000000002', orderCode: 'ORD-KIEM-THU', paymentType: 'full', method: 'payos', status: 'refunded', amount: 200000,
      paidAt: '2026-10-01T01:00:00Z', refundedAt: '2026-10-02T01:00:00Z', createdAt: '2026-09-30T10:00:00Z', metadata: { refund: { amount: 25000 } } }],
      totalOrders: 15, pagination: { page: query.page, limit: 20, total: 21, totalPages: 2 } };
  },
};

export const adminDashboardApi = {
  async recentOrders({ page, limit }) { return { items: [], pagination: { page, limit, total: 0, totalPages: 0 } }; },
  async presence() { return { totalRegisteredUsers: 1, onlineUsers: 1, newUsersLast7Days: 0 }; },
  async monthlyTrend() { return { points: [] }; },
  async insights(query) {
    return {
      period: { ...query, previousFromDate: '2026-09-01', previousToDate: '2026-09-30' },
      comparison: { platformRevenue: { current: 150000, previous: 100000, changePercent: 50 }, orders: { current: 1, previous: 1, changePercent: 0 }, cancellationRate: { current: 0, previous: 0, changePoints: 0 } },
      pendingWork: { applications: 0, support: 0, complaints: 0, suggestions: 0, withdrawals: 0, withdrawalAmount: 0 },
      attentionOrders: { awaitingProvider: 0, lateArrival: 0, overdue: 0, items: [] },
      quality: { totalRatings: 0, lowRatings: 0, providers: [] },
    };
  },
};
