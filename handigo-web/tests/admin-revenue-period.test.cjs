const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, Date, URLSearchParams, require(name) {
    if (name === './revenue-format') return { money: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }) };
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name + '.ts'));
    return require(name);
  } });
  return exports;
}
const folder = path.join(__dirname, '../src/features/admin/components/revenue');
const { revenueRangeFromSearch, previousRevenueRange } = load(path.join(folder, 'revenue-period.ts'));
const plain = value => JSON.parse(JSON.stringify(value));

test('Liên kết báo cáo giữ ngày hợp lệ, từ chối ngày giả hoặc khoảng đảo ngược', () => {
  assert.deepEqual(plain(revenueRangeFromSearch('?fromDate=2026-10-01&toDate=2026-10-31')), { fromDate: '2026-10-01', toDate: '2026-10-31' });
  for (const search of ['', '?fromDate=2026-02-30&toDate=2026-03-02', '?fromDate=2026-10-31&toDate=2026-10-01']) {
    const range = revenueRangeFromSearch(search);
    assert.match(range.fromDate, /^\d{4}-\d{2}-01$/);
    assert.ok(range.fromDate <= range.toDate);
  }
});

test('So sánh trọn tháng đúng tháng trước, gồm tháng nhuận và chuyển năm', () => {
  for (const [fromDate, toDate, previousFrom, previousTo] of [
    ['2026-10-01', '2026-10-31', '2026-09-01', '2026-09-30'],
    ['2024-03-01', '2024-03-31', '2024-02-01', '2024-02-29'],
    ['2027-01-01', '2027-01-31', '2026-12-01', '2026-12-31'],
  ]) assert.deepEqual(plain(previousRevenueRange({ fromDate, toDate })), { fromDate: previousFrom, toDate: previousTo, monthly: true });
  assert.deepEqual(plain(previousRevenueRange({ fromDate: '2026-10-10', toDate: '2026-10-16' })), { fromDate: '2026-10-03', toDate: '2026-10-09', monthly: false });
});

test('Thẻ doanh thu hiện số tiền chênh lệch và %, không chia cho 0', () => {
  const { MetricCard } = load(path.join(folder, 'MetricCard.tsx'));
  const render = (value, previous) => renderToStaticMarkup(React.createElement(MetricCard, { label: 'Phí nền tảng', description: 'Theo ngày ghi nhận', value, previous, monthly: true }));
  assert.match(render(150000, 100000), /Tăng 50\.000[^<]*50%/);
  assert.match(render(50000, 100000), /Giảm 50\.000[^<]*50%/);
  assert.ok(render(50000, 0).includes('Chưa tính được %'));
  assert.ok(render(0, 0).includes('Không thay đổi'));
});
