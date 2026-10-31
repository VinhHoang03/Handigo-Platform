const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, modules = {}) {
  const filename = path.join(__dirname, '../src/features/provider/components/home', file);
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, Date, Intl, Map, require: name => modules[name] ?? require(name) }, { filename });
  return exports;
}
const utils = load('providerHome.utils.ts');
const { getRevenueRange, getRevenueChart, dateKey, getRevenueSelection, parseRevenueSelection, moveRevenuePeriod } = utils;

test('Chọn tuần cũ lấy đúng thứ Hai đến Chủ nhật, kể cả tuần giao năm', () => {
  const range = getRevenueRange('week', '2027-01-01');
  assert.equal(dateKey(range.dates[0]), '2026-12-28');
  assert.equal(dateKey(range.dates.at(-1)), '2027-01-03');
  assert.equal(range.dates.length, 7);
  assert.equal(getRevenueSelection('week', '2027-01-01'), '2026-W53');
  assert.equal(parseRevenueSelection('week', '2026-W53'), '2026-12-28');
  assert.equal(parseRevenueSelection('week', '2021-W53'), null);
});

test('Tháng cũ gồm đủ ngày nhuận, điều hướng tháng không bị tràn từ ngày 31', () => {
  assert.equal(getRevenueRange('month', '2024-02-29').dates.length, 29);
  assert.equal(moveRevenuePeriod('month', '2024-03-31', -1), '2024-02-01');
  assert.equal(moveRevenuePeriod('month', '2024-01-31', -1), '2023-12-01');
  assert.equal(parseRevenueSelection('month', '2024-13'), null);
  assert.equal(parseRevenueSelection('year', 'abc'), null);
});

test('Năm cũ có đủ 12 tháng, tổng cộng chính xác và không lấy ngoài kỳ', () => {
  const range = getRevenueRange('year', '2024-07-01');
  assert.equal(range.dates.length, 366);
  assert.equal(dateKey(range.dates[0]), '2024-01-01');
  assert.equal(dateKey(range.dates.at(-1)), '2024-12-31');
  const chart = getRevenueChart('year', range.dates, new Map([
    ['2024-01-01', 100], ['2024-02-29', 200], ['2024-12-31', 300], ['2025-01-01', 99999],
  ]));
  assert.equal(chart.length, 12);
  assert.equal(chart[1].amount, 200);
  assert.equal(chart[2].amount, 0);
  assert.equal(chart.reduce((sum, item) => sum + item.amount, 0), 600);
  assert.equal(getRevenueRange('year', '2023-01-01').dates.length, 365);
});

function fixture() {
  const states = [], setters = [], requests = [];
  let cursor = 0, dependencies, cleanup, pending;
  const { useProviderRevenue } = load('useProviderRevenue.ts', {
    './providerHome.utils': utils,
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
        setters[index] ??= value => { states[index] = typeof value === 'function' ? value(states[index]) : value; };
        return [states[index], setters[index]];
      },
      useEffect(effect, next) {
        if (!dependencies || next.some((value, index) => value !== dependencies[index])) {
          cleanup?.(); pending = effect; dependencies = next;
        }
      },
    },
    '../../api/providerDashboard.api': { providerDashboardApi: { earnings: (fromDate, toDate) => new Promise((resolve, reject) => {
      requests.push({ fromDate, toDate, resolve, reject });
    }) } },
  });
  return { requests, render() {
    cursor = 0;
    const result = useProviderRevenue();
    if (pending) { cleanup = pending(); pending = null; }
    return result;
  } };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('Chuyển kỳ tải đúng khoảng ngày, xóa tổng cũ và bỏ phản hồi đến muộn', async () => {
  const f = fixture();
  let data = f.render();
  data.setRevenuePeriod('month'); data.setRevenueAnchor('2024-02-01');
  data = f.render();
  assert.equal(f.requests[1].fromDate, '2024-02-01');
  assert.equal(f.requests[1].toDate, '2024-02-29');
  f.requests[1].resolve({ earningsByDay: [{ day: '2024-02-29', amount: 200 }] });
  await settle();
  assert.equal(f.render().revenueTotal, 200);
  f.render().setRevenuePeriod('year');
  data = f.render();
  assert.equal(data.isLoadingEarnings, true);
  assert.equal(data.revenueTotal, 0);
  assert.equal(f.requests[2].fromDate, '2024-01-01');
  assert.equal(f.requests[2].toDate, '2024-12-31');
  f.requests[2].resolve({ earningsByDay: [{ day: '2024-12-31', amount: 300 }] });
  f.requests[0].resolve({ earningsByDay: [{ day: '2024-01-01', amount: 99999 }] });
  await settle();
  assert.equal(f.render().revenueTotal, 300);
  assert.equal(f.render().isLoadingEarnings, false);
});

test('Kỳ không có doanh thu và lỗi API có trạng thái riêng', async () => {
  const f = fixture();
  f.render(); f.requests[0].resolve({ earningsByDay: [] });
  await settle();
  assert.equal(f.render().revenueTotal, 0);
  assert.equal(f.render().isLoadingEarnings, false);
  f.render().setRevenueAnchor('2020-01-01'); f.render();
  f.requests[1].reject(Error('Lỗi giả lập'));
  await settle();
  assert.match(f.render().earningsError, /Không thể tải/);
  assert.equal(f.render().isLoadingEarnings, false);
});

test('Bộ lọc luôn hiển thị tuần, tháng, năm và các nút điều hướng kể cả khi đang tải', () => {
  const { ProviderRevenueChart } = load('ProviderRevenueChart.tsx', {
    './providerHome.utils': utils,
    './RevenueMonthPicker': load('RevenueMonthPicker.tsx'),
    '@/components/common/chart': {
      ChartCard: ({ action, toolbar }) => React.createElement('div', null, toolbar, action), BarChart: () => null,
      chartMoney: new Intl.NumberFormat('vi-VN'), chartCompactMoney: new Intl.NumberFormat('vi-VN'),
    },
  });
  const html = renderToStaticMarkup(React.createElement(ProviderRevenueChart, {
    revenuePeriod: 'year', revenueAnchor: '2024-01-01', onPeriodChange() {}, onAnchorChange() {},
    revenueChart: [], revenueTotal: 9999, revenueLabel: 'Năm 2024', isLoadingEarnings: true, earningsError: null,
  }));
  for (const text of ['Tuần', 'Tháng', 'Năm', 'Chọn năm doanh thu', '2024', 'Kỳ trước', 'Kỳ sau', 'Hiện tại', 'Đang tải']) assert.ok(html.includes(text));
  assert.ok(!html.includes('9.999'));
});

test('Bộ lọc từ chối mọi kỳ trước năm 2025', () => {
  for (const [period, value] of [['year', '2024'], ['month', '2024-12'], ['week', '2024-W52']]) {
    assert.equal(parseRevenueSelection(period, value), null);
  }
  assert.equal(parseRevenueSelection('year', '2025'), '2025-01-01');
  assert.equal(parseRevenueSelection('month', '2025-01'), '2025-01-01');
  assert.equal(parseRevenueSelection('week', '2025-W01'), '2024-12-30');
});

test('Bộ chọn có cột tháng bên trái, cột năm từ 2025 bên phải và khóa tháng tương lai', () => {
  const { RevenueMonthPicker } = load('RevenueMonthPicker.tsx', {
    react: { useState: () => [true, () => {}], useRef: () => ({ current: null }), useId: () => 'chon-thang', useEffect() {} },
  });
  const html = renderToStaticMarkup(React.createElement(RevenueMonthPicker, { value: '2026-10', max: '2026-10', onChange() {} }));
  assert.ok(html.indexOf('Chọn tháng doanh thu') < html.indexOf('Chọn năm của tháng doanh thu'));
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 2);
  assert.ok(html.includes('>2025<'));
  assert.ok(html.includes('>2026<'));
  assert.ok(!html.includes('>2024<'));
  assert.match(html, /<button[^>]*disabled=""[^>]*><span>Tháng 11/);
  assert.match(html, /<button[^>]*disabled=""[^>]*><span>Tháng 12/);
});

test('Chuyển từ tháng cuối năm cũ sang năm hiện tại không gửi tháng tương lai', () => {
  const changes = [];
  const { RevenueMonthPicker } = load('RevenueMonthPicker.tsx', {
    react: { useState: () => [true, () => {}], useRef: () => ({ current: null }), useId: () => 'chon-thang', useEffect() {} },
  });
  const tree = RevenueMonthPicker({ value: '2025-12', max: '2026-10', onChange: value => changes.push(value) });
  const buttons = [];
  const visit = node => {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!node || typeof node !== 'object') return;
    if (node.type === 'button') buttons.push(node);
    visit(node.props?.children);
  };
  visit(tree);
  buttons.find(button => button.props.children?.[0]?.props?.children === 2026).props.onClick();
  assert.equal(changes[0], '2026-10');
});
