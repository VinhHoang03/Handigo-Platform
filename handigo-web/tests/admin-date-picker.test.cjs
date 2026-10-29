const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const filename = path.join(__dirname, '../src/features/admin/components/shared/adminDatePicker.utils.ts');
const context = { exports: {}, Date };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const { daysInMonth, updateDateWheel, dateWheelParts, dateWheelValue, dateWheelUnavailable, clampDateWheel } = context.exports;

test('Đổi tháng hoặc năm tự điều chỉnh ngày cuối tháng, gồm năm nhuận', () => {
  assert.equal(updateDateWheel('2024-01-31', 'month', 2, false), '2024-02-29');
  assert.equal(updateDateWheel('2024-02-29', 'year', 2025, false), '2025-02-28');
  assert.equal(daysInMonth(1900, 2), 28);
  assert.equal(daysInMonth(2000, 2), 29);
});

test('Giữ nguyên chuỗi ngày và giờ địa phương, không chuyển lệch ngày do UTC', () => {
  const value = '2026-10-28T00:05';
  assert.equal(dateWheelValue(dateWheelParts(value), true), value);
  assert.equal(updateDateWheel(value, 'hour', 23, true), '2026-10-28T23:05');
  assert.equal(updateDateWheel(value, 'minute', 59, true), '2026-10-28T00:59');
});

test('Chặn ngày và phút ngoài giới hạn, giữ đúng mốc bao gồm hai đầu', () => {
  assert.equal(clampDateWheel('2026-10-01', false, '2026-10-10', '2026-10-20'), '2026-10-10');
  assert.equal(clampDateWheel('2026-10-30', false, '2026-10-10', '2026-10-20'), '2026-10-20');
  assert.equal(dateWheelUnavailable('2026-10-20', 'day', 20, false, '2026-10-10', '2026-10-20'), false);
  assert.equal(dateWheelUnavailable('2026-10-20', 'day', 21, false, '2026-10-10', '2026-10-20'), true);
  assert.equal(updateDateWheel('2026-10-28T09:05', 'hour', 10, true, undefined, '2026-10-28T10:00'), '2026-10-28T10:00');
  assert.equal(dateWheelUnavailable('2026-10-28T10:00', 'minute', 1, true, undefined, '2026-10-28T10:00'), true);
});

test('Vẫn chọn được năm hoặc tháng chỉ có một phần ngày hợp lệ', () => {
  assert.equal(dateWheelUnavailable('2025-12-20', 'year', 2026, false, undefined, '2026-01-15'), false);
  assert.equal(updateDateWheel('2025-12-20', 'year', 2026, false, undefined, '2026-01-15'), '2026-01-15');
  assert.equal(dateWheelUnavailable('2026-01-15', 'month', 2, false, undefined, '2026-01-15'), true);
});
