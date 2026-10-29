const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function setup(length = 90) {
  const values = [];
  let cursor = 0;
  let points = Array.from({ length }, (_, index) => ({ day: '2026-01-' + String(index + 1), amount: index + 1, count: 1 }));
  const chart = () => null;
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/features/admin/components/revenue/CollectionChart.tsx'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  vm.runInNewContext(code, { exports, require(name) {
    if (name === 'react') return { useState(initial) {
      const index = cursor++;
      if (!(index in values)) values[index] = initial;
      return [values[index], (value) => { values[index] = typeof value === 'function' ? value(values[index]) : value; }];
    } };
    if (name === '@/components/common/chart') return {
      SeriesChartView: chart, chartMoney: { format: String }, chartCompactMoney: { format: String }, dayLabel: String,
    };
    return require(name);
  } });
  function flatten(node) {
    if (!node || typeof node !== 'object') return [];
    return [node, ...[].concat(node.props?.children || []).flatMap(flatten)];
  }
  let tree;
  const render = () => { cursor = 0; tree = flatten(exports.CollectionChart({ points })); };
  render();
  return {
    data: () => tree.find((node) => node.type === chart).props.data,
    click(label) {
      const button = tree.find((node) => node.type === 'button' && (node.props['aria-label'] === label || node.props.children === label));
      assert.ok(button, 'Phải tìm thấy nút ' + label);
      assert.equal(button.props.disabled, false);
      button.props.onClick(); render();
    },
    pan(value) { tree.find((node) => node.type === 'input').props.onChange({ target: { value } }); render(); },
    replace(next) { points = next; render(); },
  };
}

test('Phóng to giảm số cột, thu nhỏ tăng số cột và xem được toàn bộ dữ liệu', () => {
  const chart = setup();
  assert.equal(chart.data().length, 31);
  assert.equal(chart.data().at(-1).amount, 90);
  chart.click('Phóng to để xem ít mốc ngày hơn');
  assert.equal(chart.data().length, 20);
  assert.equal(chart.data().at(-1).amount, 90);
  chart.click('Thu nhỏ để xem nhiều mốc ngày hơn');
  assert.equal(chart.data().length, 30);
  chart.click('Xem tất cả');
  assert.equal(chart.data().length, 90);
  chart.click('Đặt lại về tối đa 31 mốc ngày gần nhất');
  assert.equal(chart.data().length, 31);
});

test('Di chuyển xem dữ liệu cũ và tự giới hạn khi khoảng báo cáo ngắn hơn', () => {
  const chart = setup();
  chart.pan('0');
  assert.equal(chart.data()[0].amount, 1);
  assert.equal(chart.data().at(-1).amount, 31);
  chart.replace([{ day: '2026-10-28', amount: 200, count: 1 }]);
  assert.equal(chart.data().length, 1);
  assert.equal(chart.data()[0].amount, 200);
  chart.replace([]);
  assert.equal(chart.data().length, 0);
});
