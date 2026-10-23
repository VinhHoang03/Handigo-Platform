const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, modules = {}, extra = '') {
  const filename = path.join(__dirname, '../src', file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8') + extra, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Date, Intl, require: name => modules[name] ?? {} }, { filename });
  return exports;
}

const home = load('features/provider/components/home/providerHome.utils.ts');
const page = load('features/provider/pages/ProviderSchedulePage.tsx', {
  '../components/home/providerHome.utils': home,
}, '\nexport { orderDate };');

for (const status of ['accepted', 'in_progress', 'completed']) {
  test(`Lịch web giữ đơn ${status} trên ngày hẹn 17 dù thực hiện sớm ngày 16`, () => {
    const order = { status, scheduledAt: '2030-01-17T10:00:00+07:00',
      createdAt: '2030-01-15T09:00:00+07:00', schedule: { expectedStartAt: '2030-01-16T08:00:00+07:00' } };
    assert.equal(page.orderDate(order).getTime(), Date.parse(order.scheduledAt));
    assert.equal(home.getOrderDate(order).getTime(), Date.parse(order.scheduledAt));
  });
}

test('Đơn không có lịch hẹn hiển thị theo giờ bắt đầu thực tế hoặc ngày tạo', () => {
  const order = { createdAt: '2030-01-15T09:00:00+07:00', schedule: { expectedStartAt: '2030-01-16T08:00:00+07:00' } };
  assert.equal(page.orderDate(order).getTime(), Date.parse(order.schedule.expectedStartAt));
  assert.equal(home.getOrderDate(order).getTime(), Date.parse(order.schedule.expectedStartAt));
  assert.equal(page.orderDate({ ...order, schedule: null }).getTime(), Date.parse(order.createdAt));
});
