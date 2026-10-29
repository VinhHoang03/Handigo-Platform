const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { MemoryRouter } = require('react-router-dom');
const root = path.join(__dirname, '../src');

function loader(data) {
  const cache = new Map();
  let stateIndex = 0;
  const chart = {
    chartNumber: new Intl.NumberFormat('vi-VN'),
    chartMoney: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }),
    chartCompactMoney: new Intl.NumberFormat('vi-VN', { notation: 'compact' }),
    ChartCard: ({ title, children }) => React.createElement('section', null, React.createElement('h2', null, title), children),
    SelectableChartCard: ({ title, data, children, defaultType }) => React.createElement('section', null, React.createElement('h2', null, title), children(data, defaultType)),
    CategoryChartView: ({ showDetails }) => React.createElement('div', { 'data-show-details': String(showDetails) }),
    SeriesChartView: ({ type }) => React.createElement('div', { 'data-chart-type': type }),
    monthLabel: value => value,
  };
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { exports, require(name) {
      if (name === '@/components/common/chart') return { ...chart, ChartDataTable: load(path.join(root, 'components/common/chart/ChartDataTable.tsx')).ChartDataTable };
      if (name.includes('adminDashboard.api') || name.includes('adminOperations.api')) return {};
      if (name === '../feedback/AdminFeedbackDetailModal') return { AdminFeedbackDetailModal: () => null };
      if (name === './DashboardMonthlyTrend') return { DashboardMonthlyTrend: () => React.createElement('div', { 'data-monthly-history': 'true' }) };
      if (name === './DashboardUserStats') return { DashboardUserStats: () => React.createElement('a', { href: '/admin/users' }, 'Người dùng hệ thống') };
      if (name === 'react' && file.endsWith('DashboardInsights.tsx')) return {
        ...React, useState: () => [[data, false, '', null][stateIndex++], () => {}],
        useCallback: value => value, useEffect() {}, useRef: value => ({ current: value }),
      };
      if (!name.startsWith('.') && !name.startsWith('@/')) return require(name);
      const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name);
      return load(['.ts', '.tsx'].map(ext => base + ext).find(fs.existsSync));
    } }, { filename: file });
    return exports;
  }
  return name => load(path.join(root, `features/admin/components/dashboard/${name}.tsx`));
}
const metric = { current: 989200, previous: 479000, changePercent: 106.5 };
const comparison = { platformRevenue: metric, orders: { current: 133, previous: 0, changePercent: null }, cancellationRate: { current: 56.4, previous: 0, changePoints: 56.4 } };
const data = {
  period: { fromDate: '2026-09-28T17:00:00Z', toDate: '2026-10-28T16:59:59Z', previousFromDate: '2026-08-29T17:00:00Z', previousToDate: '2026-09-28T16:59:59Z' }, comparison,
  pendingWork: { applications: 2, support: 4, complaints: 0, suggestions: 0, withdrawals: 0, withdrawalAmount: 0 },
  attentionOrders: { awaitingProvider: 0, lateArrival: 10, overdue: 0, items: [{ id: 'order1', orderCode: 'DH01', status: 'accepted', createdAt: '2026-10-01T01:00:00Z' }] },
  customers: { newCustomers: 2, bookingCustomers: 3, returningCustomers: 3 },
  deposits: { heldCount: 2, heldAmount: 60000, pendingRefundAmount: 0, receivedAmount: 0, refundedAmount: 0, compensatedAmount: 0 },
  quality: { lowRatings: 0, totalRatings: 5, providers: [] },
};
const render = element => renderToStaticMarkup(React.createElement(MemoryRouter, null, element));

test('Bộ lọc tổng quan mặc định lấy trọn tháng theo giờ Việt Nam', () => {
  const file = path.join(root, 'features/admin/components/dashboard/dashboard-period.ts');
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Date });
  for (const [now, fromDate, toDate] of [
    ['2026-10-28T00:00:00Z', '2026-10-01', '2026-10-31'],
    ['2024-02-15T00:00:00Z', '2024-02-01', '2024-02-29'],
    ['2026-12-31T18:00:00Z', '2027-01-01', '2027-01-31'],
  ]) {
    const range = exports.currentDashboardMonth(new Date(now));
    assert.equal(range.fromDate, fromDate);
    assert.equal(range.toDate, toDate);
  }
});

test('Tổng quan bỏ đơn cần chú ý và cảnh báo chất lượng, giữ hàng đợi ưu tiên', () => {
  const load = loader(data);
  const { DashboardInsights } = load('DashboardInsights');
  const html = render(React.createElement(DashboardInsights));
  assert.ok(!html.includes('Đơn cần chú ý'));
  assert.ok(!html.includes('Cảnh báo chất lượng'));
  assert.ok(!html.includes('So sánh với kỳ trước'));
  assert.ok(html.indexOf('Hỗ trợ chưa phản hồi') < html.indexOf('Hồ sơ chờ xét duyệt'));
  assert.ok(html.includes('bg-warning-container'));
  for (const route of ['/admin/support', '/admin/withdrawals', '/admin/cases']) assert.ok(html.includes(`href="${route}"`));
});

test('Thẻ phí nền tảng dẫn đến báo cáo doanh thu ngay trong Tổng quan', () => {
  const { DashboardMetricGrid } = loader(data)('DashboardMetricGrid');
  const html = render(React.createElement(DashboardMetricGrid, {
    overview: { platformRevenue: 7587150, totalRevenue: 39696000, totalDeposits: 3366000 },
    providers: { averageProviderRating: 3.14, totalProviders: 12 },
    periodComparison: comparison, periodLabel: '1/10 – 31/10', overviewScope: 'lũy kế', monthly: true,
  }));
  assert.ok(html.includes('989.200'));
  assert.ok(!html.includes('7.587.150'));
  assert.ok(!html.includes('Ghi nhận lũy kế:'));
  assert.ok(!html.includes('39.696.000'));
  assert.ok(!html.includes('Tổng nạp ví'));
  assert.ok(html.includes('href="#admin-revenue"'));
  assert.ok(!html.includes('href="/admin/revenue'));
  const revenueCard = html.match(/<a[^>]*href="#admin-revenue"[^>]*>[\s\S]*?<\/a>/)[0];
  assert.ok(revenueCard.includes('Tháng trước:'));
  assert.ok(revenueCard.includes('479.000'));
  assert.match(revenueCard, /Tăng 106,5% \(510\.200[^)]*\) so với tháng trước/);
  assert.equal((revenueCard.match(/lucide-arrow-up-right/g) || []).length, 1);
});

test('Hai tiêu đề đúng tháng và không có dropdown; lịch sử tháng tải riêng dù dữ liệu hiện tại chỉ có một tháng', () => {
  const { DashboardCharts } = loader(data)('DashboardCharts');
  const html = render(React.createElement(DashboardCharts, { orders: { ordersByMonth: [{ month: '2026-10', count: 133 }], ordersByStatus: [], ordersByServiceCategory: [] }, providers: { topProvidersByRevenue: [], topProvidersByCompletedOrders: [] }, query: { fromDate: '2026-10-01', toDate: '2026-10-31' } }));
  assert.ok(html.includes('Trạng thái các đơn hiện tại (tháng 10/2026)'));
  assert.ok(html.includes('Các dịch vụ đang chiếm phần lớn nhu cầu'));
  assert.equal((html.match(/data-show-details="false"/g) || []).length, 2);
  assert.ok(html.includes('data-monthly-history="true"'));
  assert.ok(!html.includes('Phân bố toàn bộ đơn'));
  assert.ok(!html.includes('Nhà cung cấp theo doanh thu'));
});
