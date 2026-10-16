const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const filename = path.join(__dirname, '../src/features/booking/components/detail/bookingDetailTimeline.ts');
const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const exportsObject = {};
vm.runInNewContext(code, { exports: exportsObject, require });
const { buildOrderTimeline, formatTimelineTime } = exportsObject;

const event = (status, previousStatus, createdAt) => ({ status, previousStatus, createdAt, changedByRole: 'system' });
const created = event('created', null, '2026-10-15T16:10:47Z');
const accepted = event('accepted', 'created', '2026-10-15T16:11:39Z');
const reassigned = event('created', 'accepted', '2026-10-15T16:11:57Z');
const reason = 'Không tìm thấy thợ phù hợp trong bán kính 10 km sau thời gian tìm kiếm.';
const base = {
  orderCode: 'ORD-F6264FF60FC7', status: 'created', paymentStatus: 'partially_paid',
  inspectionRequired: true, serviceId: { name: 'Sửa Chữa Điều Hòa' },
  createdAt: created.createdAt, updatedAt: reassigned.createdAt,
  statusHistory: [created, accepted, reassigned],
};
const titles = steps => Array.from(steps, step => step.title);

test('Hết thời gian tìm thợ thay thế: chỉ có một lần tạo đơn và phân biệt hủy nhận với hủy đơn', () => {
  const steps = buildOrderTimeline({ ...base, status: 'cancelled',
    cancellation: { cancelledByRole: 'admin', reason, cancelledAt: '2026-10-15T16:15:02Z' },
    statusHistory: [...base.statusHistory, event('cancelled', 'created', '2026-10-15T16:15:02Z')],
  });
  assert.deepEqual(titles(steps), ['Đã tạo đơn hàng', 'Chuyên gia đã nhận đơn',
    'Chuyên gia đã hủy nhận đơn', 'Tìm chuyên gia thay thế', 'Đơn hàng đã hủy']);
  assert.equal(steps[0].time, formatTimelineTime(created.createdAt));
  assert.equal(steps[2].time, formatTimelineTime(reassigned.createdAt));
  assert.equal(steps[3].time, formatTimelineTime(reassigned.createdAt));
  assert.equal(steps[4].description, `Lý do hủy: ${reason}`);
  assert.equal(steps[4].state, 'cancelled');
  assert.equal(steps.filter(step => step.state === 'cancelled').length, 1);
});

test('Đang điều phối lại: giữ thời điểm tạo ban đầu và làm nổi bật tìm chuyên gia thay thế', () => {
  for (const inspectionRequired of [true, false]) {
    const steps = buildOrderTimeline({ ...base, inspectionRequired });
    const active = steps.filter(step => step.state === 'active');
    assert.equal(active.length, 1);
    assert.equal(active[0].title, 'Đang tìm chuyên gia thay thế');
    assert.equal(steps[0].time, formatTimelineTime(created.createdAt));
    assert.equal(titles(steps).filter(title => title === 'Đã tạo đơn hàng').length, 1);
    assert.equal(steps.at(-1).title, 'Hoàn thành');
    assert.equal(steps.at(-1).state, 'pending');
  }
});

test('Thợ thay thế nhận và hoàn tất: giữ lịch sử thợ cũ, có mốc nhận mới đúng thời gian', () => {
  const newAccepted = event('accepted', 'created', '2026-10-15T16:12:30Z');
  const activeSteps = buildOrderTimeline({ ...base, status: 'accepted', statusHistory: [...base.statusHistory, newAccepted] });
  assert.equal(activeSteps.find(step => step.state === 'active').title, 'Chuyên gia mới đã nhận đơn');
  assert.equal(activeSteps.find(step => step.title === 'Chuyên gia mới đã nhận đơn').time, formatTimelineTime(newAccepted.createdAt));
  const completedSteps = buildOrderTimeline({ ...base, status: 'completed', statusHistory: [
    ...base.statusHistory, newAccepted, event('in_progress', 'accepted', '2026-10-15T16:20:00Z'),
    event('completed', 'in_progress', '2026-10-15T17:00:00Z'),
  ] });
  assert.ok(completedSteps.every(step => step.state === 'done'));
  assert.equal(titles(completedSteps).filter(title => title === 'Đã tạo đơn hàng').length, 1);
  assert.equal(completedSteps.at(-1).title, 'Đã hoàn tất');
});

test('Nhiều thợ lần lượt hủy: mỗi lần đổi thợ có lịch sử riêng', () => {
  const steps = buildOrderTimeline({ ...base, statusHistory: [...base.statusHistory,
    event('accepted', 'created', '2026-10-15T16:12:30Z'),
    event('created', 'accepted', '2026-10-15T16:13:00Z'),
  ] });
  assert.equal(titles(steps).filter(title => title === 'Đã tạo đơn hàng').length, 1);
  assert.equal(titles(steps).filter(title => title === 'Chuyên gia đã hủy nhận đơn').length, 2);
  assert.equal(steps.filter(step => step.state === 'active').length, 1);
  assert.equal(steps.find(step => step.state === 'active').time, formatTimelineTime('2026-10-15T16:13:00Z'));
});

test('Lịch sử cũ thiếu previousStatus vẫn nhận diện được nhận đơn rồi tìm lại', () => {
  const steps = buildOrderTimeline({ ...base, statusHistory: base.statusHistory.map(({ previousStatus, ...rest }) => rest) });
  assert.equal(titles(steps).filter(title => title === 'Đã tạo đơn hàng').length, 1);
  assert.equal(steps.find(step => step.state === 'active').title, 'Đang tìm chuyên gia thay thế');
});

test('Đơn chưa từng đổi thợ vẫn hiển thị bốn mốc bình thường', () => {
  const steps = buildOrderTimeline({ ...base, statusHistory: [created] });
  assert.equal(steps.length, 4);
  assert.deepEqual(Array.from(steps, step => step.state), ['active', 'pending', 'pending', 'pending']);
  assert.equal(steps[0].time, formatTimelineTime(created.createdAt));
  assert.equal(steps[1].title, 'Chờ chuyên gia nhận đơn');
});
