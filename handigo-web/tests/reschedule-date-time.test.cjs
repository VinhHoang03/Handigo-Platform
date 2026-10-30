const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const exportsObject = {};
const filename = path.join(__dirname, '../src/features/booking/utils/rescheduleDateTime.ts');
vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: exportsObject, Date, Math });
const { isRescheduleTimeAllowed, rescheduleTimestamp, vietnamDateTimeValue, firstRescheduleTime } = exportsObject;

test('Khóa giờ 08:00–21:00, chỉ phút 00 được chọn khi giờ là 21', () => {
  const earliest = Date.parse('2026-11-01T00:00:00+07:00');
  for (const [time, expected] of [['07:59', false], ['08:00', true], ['20:59', true], ['21:00', true], ['21:01', false], ['22:00', false]]) {
    assert.equal(isRescheduleTimeAllowed(`2026-11-01T${time}`, earliest), expected, time);
  }
});

test('Thời gian chọn giữ nguyên giờ Việt Nam khi gửi API', () => {
  assert.equal(new Date(rescheduleTimestamp('2026-11-01T08:30')).toISOString(), '2026-11-01T01:30:00.000Z');
  assert.equal(vietnamDateTimeValue(Date.parse('2026-10-31T18:00:00Z')), '2026-11-01T01:00');
});

test('Bỏ ngày hết giờ, làm tròn lên phút và chặn giờ chưa đủ thời gian báo trước', () => {
  const earliest = Date.parse('2026-11-01T15:48:30+07:00');
  assert.equal(firstRescheduleTime('2026-11-01', earliest), '2026-11-01T15:49');
  assert.equal(isRescheduleTimeAllowed('2026-11-01T15:48', earliest), false);
  assert.equal(firstRescheduleTime('2026-10-31', earliest), null);
  assert.equal(firstRescheduleTime('2026-11-02', earliest), '2026-11-02T08:00');
  assert.equal(firstRescheduleTime('2026-11-01', Date.parse('2026-11-01T21:00:01+07:00')), null);
});
