const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, modules = {}) {
  const filename = path.join(__dirname, '../src', file);
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, Date, Intl, require: name => modules[name] ?? require(name) }, { filename });
  return exports;
}
const utils = load('features/provider/components/home/providerHome.utils.ts');
const { ProviderHomeHeader } = load('features/provider/components/home/ProviderHomeHeader.tsx', {
  'react-router-dom': { Link: ({ to, children, ...props }) => React.createElement('a', { href: to, ...props }, children) },
});
const { ProviderHomeStats } = load('features/provider/components/home/ProviderHomeStats.tsx', { './providerHome.utils': utils });

test('Lời chào và lời chúc hiển thị trọn họ tên, không cố định buổi sáng', () => {
  const html = renderToStaticMarkup(React.createElement(ProviderHomeHeader, { fullName: 'Nguyễn Văn Minh', activeOrders: 7 }));
  assert.match(html, /Xin chào, Nguyễn Văn Minh!/);
  assert.match(html, /Chúc bạn một ngày làm việc hiệu quả/);
  assert.match(html, /Bạn đang thực hiện 7 đơn/);
  assert.doesNotMatch(html, /Chào buổi sáng|Hôm nay bạn có/);
});

const stats = overrides => renderToStaticMarkup(React.createElement(ProviderHomeStats, {
  totalOrders: 120, activeOrders: 7, monthlyIncome: 288000, isLoadingIncome: false, incomeError: null,
  isLoadingOrders: false, isLoadingActiveOrders: false, rating: { average: 4.8, total: 10 }, ...overrides,
}));
test('Thẻ thu nhập có kỳ rõ ràng và không còn chú thích đã bỏ', () => {
  const html = stats();
  assert.match(html, /Thu nhập tháng này/); assert.match(html, /288\.000/);
  assert.doesNotMatch(html, /Sau phí nền tảng|Không phải số dư ví/);
  assert.doesNotMatch(html, /Thu nhập gần đây/);
});
test('Đang tải hoặc lỗi không hiển thị thu nhập 0 giả', () => {
  assert.match(stats({ monthlyIncome: null, isLoadingIncome: true }), /Đang tải…/);
  const html = stats({ monthlyIncome: null, incomeError: 'Nguồn thu nhập tạm lỗi' });
  assert.match(html, /Chưa tải được/); assert.doesNotMatch(html, /288\.000/);
  assert.match(stats({ monthlyIncome: 0 }), />0\s*₫</);
});

function setup({ failIncome = false, failOrders = false } = {}) {
  const state = [], setters = [], effects = [], calls = [];
  let cursor = 0;
  const useState = initial => {
    const index = cursor++;
    if (!(index in state)) state[index] = initial;
    setters[index] ??= value => { state[index] = typeof value === 'function' ? value(state[index]) : value; };
    return [state[index], setters[index]];
  };
  const hooks = { react: { useState, useEffect: effect => effects.push(effect) }, '@/components/common/Toast': { useToastFeedback: useState } };
  const orderApi = { getRecentOrders: async () => [{ status: 'accepted', pricing: { providerEarningAmount: 9999999 } }],
    getProviderOrders: async (page, limit, status) => {
      calls.push({ page, limit, status }); if (failOrders) throw Error('Nguồn đơn tạm lỗi');
      return { items: [], pagination: { total: status === 'in_progress' ? 7 : 120 } };
    } };
  const orderHook = load('features/provider/components/home/useProviderOrdersSchedule.ts', {
    ...hooks, '../../api/providerOrder.api': { providerOrderApi: orderApi }, './providerHome.utils': utils,
  });
  const { useProviderHomeData } = load('features/provider/components/home/useProviderHomeData.ts', {
    ...hooks, './useProviderOrdersSchedule': orderHook, './useProviderRevenue': { useProviderRevenue: () => ({}) },
    './useProviderRating': { useProviderRating: () => ({ rating: { average: 4.8, total: 10 } }) }, '../../api/providerDashboard.api': {
      providerDashboardApi: { overview: async () => { if (failIncome) throw Error('Nguồn thu nhập tạm lỗi'); return { monthlyEarnings: 288000 }; } },
    },
  });
  const render = () => { cursor = 0; return useProviderHomeData(); };
  const initial = render();
  const cleanups = effects.splice(0).map(effect => effect());
  return { initial, calls, render, unmount: () => cleanups.forEach(cleanup => cleanup?.()) };
}
test('Thu nhập lấy từ tổng quan, số đơn đang thực hiện lấy tổng phân trang đúng trạng thái', async () => {
  const runtime = setup();
  assert.equal(runtime.initial.monthlyIncome, null);
  await new Promise(setImmediate);
  const result = runtime.render();
  assert.equal(result.monthlyIncome, 288000); assert.equal(result.activeOrders, 7); assert.equal(result.totalOrders, 120);
  assert.equal(result.rating.average, 4.8); assert.equal(result.rating.total, 10);
  assert(runtime.calls.some(call => call.page === 1 && call.limit === 1 && call.status === 'in_progress'));
  assert.notEqual(result.monthlyIncome, result.recentOrders[0].pricing.providerEarningAmount);
  runtime.unmount();
});
test('Lỗi API giữ trạng thái chưa tải được thay vì biến thành không có thu nhập hoặc đơn', async () => {
  const runtime = setup({ failIncome: true, failOrders: true });
  await new Promise(setImmediate);
  const result = runtime.render();
  assert.equal(result.monthlyIncome, null); assert.equal(result.activeOrders, null); assert.equal(result.totalOrders, null);
  assert.equal(result.isLoadingIncome, false); assert.equal(result.isLoadingActiveOrders, false);
  assert.match(result.incomeError, /Không thể tải thu nhập tháng này/);
  runtime.unmount();
});
