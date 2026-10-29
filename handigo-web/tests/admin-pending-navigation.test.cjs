const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');
const { createElement } = require('react');

function load(relative) {
  const file = path.join(__dirname, '../src', relative);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require }, { filename: file });
  return exports;
}
const { withAdminPendingCounts, isPendingWorkMutation } = load('features/admin/utils/adminPendingNavigation.ts');
const { NavPendingBadge } = load('components/common/dashboard/NavPendingBadge.tsx');
const counts = { applications: 2, support: 3, complaints: 4, suggestions: 5, withdrawals: 6, withdrawalAmount: 0, attentionOrders: 7, reports: 8, refunds: 9, asOf: '' };
const paths = ['/admin', '/admin/provider-applications', '/admin/service-suggestions', '/admin/withdrawals', '/admin/support', '/admin/cases', '/admin/payments', '/admin/news'];
const items = paths.map(item => ({ path: item, label: item, icon: () => null }));

test('Badge dùng tổng báo cáo chung, không đếm hai lần báo cáo chất lượng hoặc gắn số vào mục không có hàng đợi', () => {
  const result = withAdminPendingCounts(items, counts);
  assert.deepEqual(Array.from(result, item => item.pendingCount), [7, 2, 5, 6, 3, 8, 9, undefined]);
  assert.match(result[5].pendingLabel, /8 báo cáo chờ xem xét/);
  assert.equal(result[7], items[7]);
  assert.equal(withAdminPendingCounts(items, null), items);
  assert.equal(withAdminPendingCounts(items, counts, true)[0].pendingStale, true);
});

test('Ẩn số 0 hoặc không xác định; số lớn hiện 99+ và chế độ thu gọn có vị trí riêng', () => {
  for (const count of [0, -1, undefined, NaN, Infinity]) assert.equal(renderToStaticMarkup(createElement(NavPendingBadge, { count })), '');
  assert.match(renderToStaticMarkup(createElement(NavPendingBadge, { count: 2 })), />2<\/span>/);
  assert.match(renderToStaticMarkup(createElement(NavPendingBadge, { count: 120, compact: true })), /absolute.*99\+/);
  assert.match(renderToStaticMarkup(createElement(NavPendingBadge, { count: 2, stale: true })), /opacity-60/);
});

test('Chỉ cập nhật lại sau thao tác ghi liên quan; không lặp do đọc số liệu hoặc làm mới xác thực', () => {
  for (const [method, url] of [['patch', '/admin/provider-applications/1/review'], ['PATCH', '/withdrawals/admin/1/approve'], ['post', '/admin/support-tickets/1/responses'], ['patch', '/service-suggestions/1'], ['post', '/payments/1/refund/retry']]) {
    assert.equal(isPendingWorkMutation(method, url), true);
  }
  for (const [method, url] of [['get', '/dashboard/pending-work'], ['get', '/admin/provider-applications'], ['post', '/auth/refresh-token'], ['post', '/conversations/1/messages'], ['patch', '/administer/1'], [undefined, undefined]]) {
    assert.equal(isPendingWorkMutation(method, url), false);
  }
});
