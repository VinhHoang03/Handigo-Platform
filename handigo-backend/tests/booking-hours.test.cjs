const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Chạy hàm thật với múi giờ máy tùy ý, không kết nối database hoặc model.
function load(file) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports, require: () => ({}), Date });
  return exports;
}
const backend = load('../src/utils/bookingPolicy.ts');
const web = load('../../handigo-web/src/features/booking/components/step2Helpers.ts');
const { bookingSchema } = require('../dist/ai/tools/implementations/booking.schemas');
for (const [time, allowed] of [['07:59', false], ['08:00', true], ['12:30', true], ['20:59', true], ['21:00', true], ['21:01', false], ['23:59', false]]) {
  test(`Giới hạn giờ Việt Nam ${time}: ${allowed}`, () => {
    const instant = new Date(`2030-10-04T${time}:00+07:00`);
    assert.equal(backend.isWithinAppointmentHours(instant), allowed);
    assert.equal(web.isWithinImmediateBookingHours(instant), allowed);
    assert.equal(web.isWithinScheduledBookingHours(time), allowed);
    assert.equal(backend.isWithinAppointmentHours(new Date(instant.toISOString())), allowed);
    assert.equal(bookingSchema.safeParse({
      serviceId: '100000000000000000000001', addressId: '100000000000000000000002',
      paymentMethod: 'wallet', orderType: 'scheduled', scheduledAt: instant.toISOString(),
    }).success, allowed);
  });
}
test('Giờ mặc định hợp lệ trước mở cửa và sau đóng cửa', () => {
  assert.equal(web.getDefaultScheduledAt(new Date(2030, 9, 4, 7, 59)), '2030-10-04T08:00:00');
  assert.equal(web.getDefaultScheduledAt(new Date(2030, 9, 4, 21, 1)), '2030-10-05T08:00:00');
  assert.equal(web.getInitialScheduledAt('2030-10-05T22:00:00', new Date(2030, 9, 4, 10)), '2030-10-04T10:00:00');
  assert.equal(backend.isWithinAppointmentHours(new Date(NaN)), false);
  assert.equal(web.isWithinImmediateBookingHours(new Date(NaN)), false);
});
