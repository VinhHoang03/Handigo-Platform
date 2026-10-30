const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(file, modules) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: name => name in modules ? modules[name] : require(name) });
  return exports;
}
const Table = () => React.createElement('table');
const formatters = { chartNumber: new Intl.NumberFormat('vi-VN'), chartMoney: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }), chartCompactMoney: new Intl.NumberFormat('vi-VN', { notation: 'compact' }), monthLabel: String, ChartDataTable: Table };
const components = Object.fromEntries(['Area', 'Bar', 'CartesianGrid', 'ComposedChart', 'Line', 'ResponsiveContainer', 'Tooltip', 'XAxis', 'YAxis'].map(name => [name, () => null]));
const { MonthlyOperationsChart } = load('features/admin/components/dashboard/DashboardMonthlyTrend.tsx', {
  recharts: components,
  react: { ...React, useId: () => 'monthly-test' },
  '@/components/common/AsyncState': {},
  '@/components/common/chart': formatters,
  '@/components/common/chart/ChartA11yTable': { ChartA11yTable: Table },
  '@/components/common/chart/chart-theme': { chartAxisStyle: { fill: '#000' }, chartTooltipStyle: {}, chartGridStroke: '#ddd' },
  '@/components/common/chart/use-prefers-reduced-motion': { usePrefersReducedMotion: () => true },
  '@/utils/apiError': {}, '../../api/adminDashboard.api': {},
});
const points = [{ month: '2026-10', orders: 12, completedRevenue: 5000000, platformRevenue: 989200 }];
const flatten = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(flatten)];

test('Biểu đồ có vùng doanh thu, đường đơn hoàn thành và thu nhập dùng đúng hai trục', () => {
  const tree = flatten(MonthlyOperationsChart({ points, type: 'composed' }));
  const axes = tree.filter(item => item.type === components.YAxis);
  assert.deepEqual(axes.map(item => item.props.yAxisId), ['orders', 'revenue']);
  assert.equal(axes[0].props.orientation, 'right');
  assert.equal(tree.find(item => item.type === components.Area).props.dataKey, 'completedRevenue');
  assert.equal(tree.filter(item => item.type === components.Line).length, 2);
  assert.equal(tree.find(item => item.type === components.Line && item.props.dataKey === 'orders').props.yAxisId, 'orders');
  assert.equal(tree.find(item => item.type === components.Line && item.props.dataKey === 'platformRevenue').props.yAxisId, 'revenue');
  assert.equal(flatten(MonthlyOperationsChart({ points, type: 'bar' })).filter(item => item.type === components.Bar).length, 3);
  assert.equal(flatten(MonthlyOperationsChart({ points, type: 'line' })).filter(item => item.type === components.Line).length, 3);
  const table = MonthlyOperationsChart({ points, type: 'table' });
  assert.ok(table.props.rows[0][2].includes('5.000.000'));
  assert.ok(table.props.rows[0][3].includes('989.200'));
});

test('Ẩn dropdown chi tiết ở biểu đồ danh mục vẫn giữ tùy chọn xem dạng bảng', () => {
  const { CategoryChartView } = load('components/common/chart/ChartViews.tsx', {
    './BarChart': { BarChart: () => null }, './DonutChart': { DonutChart: () => null }, './LineChart': {},
    './ChartDataTable': { ChartDataTable: Table }, './chart-format': formatters,
  });
  const props = { data: [{ label: 'Đơn', value: 12 }], title: 'Kiểm thử', type: 'horizontal' };
  assert.ok(!renderToStaticMarkup(React.createElement(CategoryChartView, { ...props, showDetails: false })).includes('Xem số liệu chi tiết'));
  assert.ok(renderToStaticMarkup(React.createElement(CategoryChartView, props)).includes('Xem số liệu chi tiết'));
  assert.equal(CategoryChartView({ ...props, type: 'table', showDetails: false }).type, Table);
});
