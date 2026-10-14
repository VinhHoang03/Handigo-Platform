const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const file = path.resolve(__dirname, '../../../handigo-web/src/features/booking/components/detail/bookingDetailTimeline.ts');
const loaded = new Module(file);
loaded.paths = Module._nodeModulePaths(path.dirname(file));
loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const { buildOrderTimeline, formatTimelineTime } = loaded.exports;
const order = {
  status: 'created', paymentStatus: 'unpaid', orderCode: 'ORD-KIEM-THU',
  serviceId: { name: 'Vệ Sinh Điều Hòa' },
  providerId: { userId: { fullName: 'Nguyễn Văn An' } },
  createdAt: '2026-10-02T13:25:41Z', updatedAt: '2026-10-10T01:00:00Z',
  statusHistory: [{ status: 'created', createdAt: '2026-10-02T13:25:41Z' }],
};
const waiting = buildOrderTimeline(order);
assert.equal(waiting.length, 4, 'Đơn mới có lịch sử vẫn phải hiển thị đủ bốn mốc.');
assert.deepEqual(waiting.map(step => step.state), ['active', 'pending', 'pending', 'pending']);
assert.equal(waiting[1].title, 'Chờ chuyên gia nhận đơn', 'Được gán thợ không đồng nghĩa đã nhận đơn.');
assert.match(waiting[0].description, /Vệ Sinh Điều Hòa.*ORD-KIEM-THU/);
const cash = buildOrderTimeline({ ...order, paymentMethod: 'cash', paymentStatus: 'unpaid', inspectionRequired: false });
assert.match(cash[1].description, /tiền mặt/);
assert.doesNotMatch(cash[1].description, /hoàn tất thanh toán/);
const completed = buildOrderTimeline({ ...order, status: 'completed', statusHistory: [
  ...order.statusHistory,
  { status: 'accepted', createdAt: '2026-10-02T13:30:00Z' },
  { status: 'in_progress', createdAt: '2026-10-02T14:00:00Z' },
  { status: 'completed', createdAt: '2026-10-08T17:05:17Z' },
] });
assert.equal(completed.length, 4);
assert.ok(completed.every(step => step.state === 'done'));
assert.equal(completed[1].title, 'Nguyễn Văn An đã nhận đơn');
assert.equal(completed[1].time, formatTimelineTime('2026-10-02T13:30:00Z'));
assert.equal(completed[2].time, formatTimelineTime('2026-10-02T14:00:00Z'));
assert.equal(completed[3].time, formatTimelineTime('2026-10-08T17:05:17Z'), 'Mốc hoàn thành không lấy thời gian cập nhật sau đó.');
assert.match(completed[2].description, /đã thực hiện/);
const legacy = buildOrderTimeline({ ...order, statusHistory: undefined });
assert.equal(legacy.length, 4);
assert.equal(legacy[0].time, formatTimelineTime(order.createdAt));
const cancelled = buildOrderTimeline({ ...order, status: 'cancelled', statusHistory: [
  ...order.statusHistory, { status: 'cancelled', note: 'Khách hủy đơn', createdAt: order.updatedAt },
] });
assert.equal(cancelled.length, 2);
assert.equal(cancelled[1].state, 'cancelled');
assert.equal(cancelled[1].title, 'Đơn hàng đã hủy');
assert.equal(cancelled[1].description, 'Lý do hủy: Khách hủy đơn');
assert.ok(cancelled.every(step => !step.title.includes('·') && step.description));
const cancellation = { reason: 'Khách thay đổi lịch', cancelledAt: '2026-10-13T16:14:06Z' };
const missingEvent = buildOrderTimeline({ ...order, status: 'cancelled', cancellation });
assert.equal(missingEvent.at(-1).description, 'Lý do hủy: Khách thay đổi lịch');
assert.equal(missingEvent.at(-1).time, formatTimelineTime(cancellation.cancelledAt));
assert.equal(missingEvent.at(-1).state, 'cancelled');
const noHistory = buildOrderTimeline({ ...order, status: 'cancelled', cancellation, statusHistory: undefined });
assert.equal(noHistory[0].description, 'Lý do hủy: Khách thay đổi lịch');
console.log('Đạt: đủ bốn mốc, dữ liệu cũ/mới, thời gian lịch sử, thợ chưa nhận và đơn đã hủy.');
