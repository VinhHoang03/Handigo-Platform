export const adminRevenueApi = { async getRevenue(range) {
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
  async providerAnalytics() { return { topProvidersByRevenue: [] }; },
  async payments(query) {
    window.__paymentQueries ??= [];
    window.__paymentQueries.push(query);
    return { items: [{ _id: '000000000000000000000001', orderId: '000000000000000000000002', orderCode: 'ORD-KIEM-THU', paymentType: 'full', method: 'payos', status: 'refunded', amount: 200000,
      paidAt: '2026-10-01T01:00:00Z', refundedAt: '2026-10-02T01:00:00Z', createdAt: '2026-09-30T10:00:00Z', metadata: { refund: { amount: 25000 } } }],
      pagination: { page: query.page, limit: 20, total: 21, totalPages: 2 } };
  },
};
