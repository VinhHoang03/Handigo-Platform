const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, modules = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require(name) {
    if (name in modules) return modules[name];
    if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), `${name}.ts`), modules);
    return require(name);
  } });
  return exports;
}
const { bookingPolicyFields } = load('features/admin/components/system-configs/booking-policy.ts');
const { configDefinitions } = load('features/admin/components/system-configs/config-catalog.ts', { 'lucide-react': {} });

test('Admin có đúng ba hàng cấu hình độc lập, mặc định 200 mét, 10 phút, 5 phút và lưu riêng từng giá trị', () => {
  const { formatConfigValue, mergeConfigItems } = load('features/admin/components/system-configs/system-config-format.ts', {
    './config-definitions': { configDefinitions },
  });
  const defaults = { PROVIDER_ARRIVAL_RADIUS_METERS: 200, CUSTOMER_NO_SHOW_WAIT_MINUTES: 10, CUSTOMER_CANCELLATION_MINUTES: 5 };
  const rows = mergeConfigItems([]).filter(item => item.key in defaults);
  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.equal(row.currentValue, defaults[row.key]);
    assert.equal(row.type, 'NUMBER');
    assert.equal(row.group, 'booking');
  }
  assert.equal(formatConfigValue(rows[0], 350), '350 mét');
  assert.equal(formatConfigValue(rows[1], 7), '7 phút');
  assert.equal(formatConfigValue(rows[2], 12), '12 phút');
  assert.ok(!bookingPolicyFields.some(([key]) => ['providerArrivalRadiusMeters', 'customerNoShowWaitMinutes', 'customerCancellationMinutes'].includes(key)));
  const saved = mergeConfigItems([{ key: 'CUSTOMER_NO_SHOW_WAIT_MINUTES', type: 'NUMBER', value: 7 }]);
  assert.equal(saved.find(item => item.key === 'CUSTOMER_NO_SHOW_WAIT_MINUTES').currentValue, 7);
  assert.equal(saved.find(item => item.key === 'CUSTOMER_CANCELLATION_MINUTES').currentValue, 5);
});

test('Điều khoản hiển thị thời hạn hủy cấu hình hiện tại thay cho 5 phút cố định', () => {
  const { BookingPolicyContent } = load('features/booking/components/BookingPolicyContent.tsx');
  const tree = BookingPolicyContent({ policies: { customerCancellationMinutes: 12, paymentHoldMinutes: 15,
    matching: { initialRadiusKm: 5, expandedRadiusKm: 10, expandAfterMinutes: 1, expandedDurationMinutes: 3, providerResponseSeconds: 60 },
    fixedPriceRefund: {} } });
  function text(node) {
    if (Array.isArray(node)) return node.map(text).join('');
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    return node && typeof node === 'object' ? text(node.props?.children) : '';
  }
  assert.match(text(tree), /hủy trong vòng 12 phút/);
  assert.match(text(tree), /Hết 12 phút/);
  assert.doesNotMatch(text(tree), /Hết 5 phút/);
});
