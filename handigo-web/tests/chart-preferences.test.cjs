const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function mount(storage, overrides = {}) {
  const state = [];
  let cursor = 0;
  let tree;
  let displayed;
  const Menu = () => null;
  const exports = {};
  const filename = path.join(__dirname, '../src/components/common/chart/SelectableChartCard.tsx');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, window: { localStorage: storage }, require(name) {
    if (name === 'react') return {
      useState(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
        return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
      }, useEffect() {}, useRef: initial => ({ current: initial }),
    };
    if (name === './ChartCard') return { ChartCard: () => null };
    if (name === './ChartTypeMenu') return { ChartTypeMenu: Menu };
    if (name === '@/utils/apiError') return { getErrorMessage: () => 'Không thể tải dữ liệu' };
    return require(name);
  } }, { filename });
  let props = {
    title: 'Đơn theo trạng thái', storageKey: 'dashboard.order-status', defaultType: 'line',
    options: [{ value: 'line' }, { value: 'bar' }], data: [1], isEmpty: () => false,
    onReload: async () => [2], children: (data, type) => { displayed = { data, type }; return null; },
    ...overrides,
  };
  const render = (updates = {}) => { props = { ...props, ...updates }; cursor = 0; tree = exports.SelectableChartCard(props); };
  const actions = () => tree.props.action.props.children;
  render();
  return {
    render,
    selected: () => displayed.type,
    menuValue: () => actions().find(node => node.type === Menu).props.value,
    choose(value) { actions().find(node => node.type === Menu).props.onChange(value); render(); },
    async refresh() { actions()[0].props.onClick(); await new Promise(setImmediate); render(); },
    data: () => displayed.data,
  };
}
const storage = () => {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};

test('Lưu và khôi phục kiểu của từng biểu đồ sau khi tải lại trang', () => {
  const local = storage();
  const chart = mount(local);
  assert.equal(chart.selected(), 'line');
  chart.choose('bar');
  assert.equal(local.values.get('handigo.admin.chart-type.dashboard.order-status'), 'bar');
  assert.equal(mount(local).selected(), 'bar');
  assert.equal(mount(local, { storageKey: 'revenue.daily-collections' }).selected(), 'line');
});

test('Làm mới dữ liệu và thay đổi tiêu đề không ghi đè lựa chọn', async () => {
  const local = storage();
  const chart = mount(local);
  chart.choose('bar');
  await chart.refresh();
  assert.equal(chart.data()[0], 2);
  assert.equal(chart.selected(), 'bar');
  chart.render({ title: 'Tiêu đề đã đổi', defaultType: 'line', data: [3] });
  assert.equal(chart.selected(), 'bar');
  assert.equal(chart.menuValue(), 'bar');
});

test('Loại bỏ kiểu lưu không hợp lệ và không chấp nhận giá trị ngoài menu', () => {
  const local = storage();
  local.setItem('handigo.admin.chart-type.dashboard.order-status', 'khong-hop-le');
  const chart = mount(local);
  assert.equal(chart.selected(), 'line');
  chart.choose('khong-hop-le');
  assert.equal(chart.selected(), 'line');
  chart.choose('bar');
  chart.render({ options: [{ value: 'line' }] });
  assert.equal(chart.selected(), 'line');
});

test('Lưu trữ bị chặn vẫn cho phép mở và đổi kiểu biểu đồ', () => {
  const blocked = { getItem() { throw Error('Bị chặn'); }, setItem() { throw Error('Bị chặn'); } };
  const chart = mount(blocked);
  assert.equal(chart.selected(), 'line');
  chart.choose('bar');
  assert.equal(chart.selected(), 'bar');
});
