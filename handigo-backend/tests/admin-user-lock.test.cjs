const { test } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');
const mongoose = require('mongoose');
const User = require('../src/models/user.model').default;
const { Violation } = require('../src/models/violation.model');
const { Session } = require('../src/models/session.model');
const { ViolationEmail } = require('../src/models/violationEmail.model');
const socket = require('../src/sockets/socketServer');
const { updateUserStatusSchema } = require('../src/validations/admin.validator');
const { updateUserStatus } = require('../src/services/admin.service');

const lock = (overrides = {}) => ({ status: 'locked', reason: 'Vi phạm quy định trò chuyện',
  severity: 'HIGH', penaltyType: 'TEMPORARY_SUSPEND', durationDays: 3, ...overrides });

test('Validation bắt buộc lý do và thời hạn tạm khóa hợp lệ, vĩnh viễn không có thời hạn', () => {
  assert.ok(updateUserStatusSchema.safeParse(lock()).success);
  assert.ok(updateUserStatusSchema.safeParse({ status: 'active' }).success);
  for (const payload of [
    { status: 'locked' }, lock({ reason: '     ' }), lock({ severity: 'UNKNOWN' }),
    lock({ durationDays: undefined }), lock({ durationDays: 0 }), lock({ durationDays: -1 }),
    lock({ durationDays: 1.5 }), lock({ durationDays: 3651 }), lock({ durationDays: '3' }),
    lock({ penaltyType: 'PERMANENT_BAN' }),
  ]) assert.equal(updateUserStatusSchema.safeParse(payload).success, false, JSON.stringify(payload));
  assert.ok(updateUserStatusSchema.safeParse(lock({ penaltyType: 'PERMANENT_BAN', durationDays: undefined })).success);
});

function fixture(t, { status = 'active', role = 'CUSTOMER', queueError = false, absent = false } = {}) {
  const adminId = String(new mongoose.Types.ObjectId());
  const userId = String(new mongoose.Types.ObjectId());
  const violationId = new mongoose.Types.ObjectId();
  const user = new User({ _id: userId, status, role, email: 'khach@example.com', fullName: 'Khách' });
  const session = {};
  const events = [];
  let record;
  let email;
  let resolved;
  const query = value => ({ select() { return this; }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
  t.mock.method(mongoose.connection, 'transaction', async work => {
    const value = await work(session); events.push('commit'); return value;
  });
  t.mock.method(User, 'findOneAndUpdate', (filter, _update, options) => {
    assert.equal(filter.isDeleted, false);
    assert.equal(options.session, session);
    return query(absent ? null : user);
  });
  t.mock.method(User, 'findOne', () => query(user));
  user.save = async options => { assert.equal(options.session, session); events.push('tai-khoan'); };
  t.mock.method(User, 'updateOne', async (_filter, update, options) => {
    assert.equal(options.session, session);
    user.status = update.$set.status;
  });
  t.mock.method(Violation, 'create', async (items, options) => {
    assert.equal(options.session, session);
    record = { ...items[0], _id: violationId };
    events.push('vi-pham');
    return [record];
  });
  t.mock.method(Violation, 'updateMany', async (filter, _update, options) => {
    assert.equal(options.session, session);
    resolved = filter;
  });
  t.mock.method(Session, 'updateMany', async (_filter, _update, options) => {
    assert.equal(options.session, session); events.push('thu-hoi-phien');
  });
  t.mock.method(ViolationEmail, 'create', async (items, options) => {
    assert.equal(options.session, session);
    if (queueError) throw new Error('Không lưu được hàng đợi');
    email = items[0]; events.push('email');
  });
  const disconnect = t.mock.method(socket, 'disconnectUserSockets', () => events.push('socket'));
  return { adminId, userId, user, events, disconnect, get record() { return record; },
    get email() { return email; }, get resolved() { return resolved; } };
}

test('Khóa nhanh tạm thời lưu lịch sử, nguồn tự mở và email đúng số ngày cùng giao dịch', async t => {
  const context = fixture(t);
  await updateUserStatus(context.adminId, context.userId, lock());
  const { record, email, user, events } = context;
  assert.equal(record.endAt.getTime() - record.startAt.getTime(), 3 * 86400000);
  assert.equal(user.status, 'locked');
  assert.equal(String(user.temporaryLockId), String(record._id));
  assert.equal(String(record.handledBy), context.adminId);
  assert.equal(record.reason, lock().reason);
  assert.equal(email.to, user.email);
  assert.match(email.text, /3 ngày/);
  assert.match(email.text, /Bạn sẽ được mở khóa tài khoản vào/);
  assert.ok(events.indexOf('email') < events.indexOf('commit'));
  assert.ok(events.indexOf('thu-hoi-phien') < events.indexOf('commit'));
  assert.ok(events.indexOf('commit') < events.indexOf('socket'));
});

test('Khóa vĩnh viễn không có mốc tự mở hoặc số ngày trong email', async t => {
  const context = fixture(t);
  await updateUserStatus(context.adminId, context.userId, lock({ penaltyType: 'PERMANENT_BAN', durationDays: undefined }));
  assert.equal(context.record.endAt, null);
  assert.equal(context.record.penalty.durationDays, null);
  assert.equal(context.user.temporaryLockId, undefined);
  assert.match(context.email.text, /khóa vĩnh viễn/);
  assert.ok(!context.email.text.includes('Bạn sẽ được mở khóa tài khoản vào'));
});

test('Mở khóa sớm kết thúc hình phạt khóa hiện hành và không tạo thêm vi phạm hoặc email khóa', async t => {
  const context = fixture(t, { status: 'locked' });
  await updateUserStatus(context.adminId, context.userId, { status: 'active' });
  assert.equal(context.user.status, 'active');
  assert.equal(context.resolved.status, 'active');
  assert.equal(context.resolved.userId, context.userId);
  assert.ok(context.resolved.penaltyType.$in.includes('PERMANENT_BAN'));
  assert.equal(context.record, undefined);
  assert.equal(context.email, undefined);
});

for (const [label, options, code] of [
  ['đã khóa hoặc yêu cầu bị gửi hai lần', { status: 'locked' }, 409],
  ['là quản trị viên', { role: 'ADMIN' }, 400],
  ['không tồn tại hoặc đã xóa', { absent: true }, 404],
]) test(`Không tạo quyết định/email khi tài khoản ${label}`, async t => {
  const context = fixture(t, options);
  await assert.rejects(updateUserStatus(context.adminId, context.userId, lock()), error => error.statusCode === code);
  assert.equal(context.record, undefined);
  assert.equal(context.email, undefined);
  assert.equal(context.disconnect.mock.callCount(), 0);
});

test('Không được khóa chính mình', async t => {
  const context = fixture(t);
  await assert.rejects(updateUserStatus(context.adminId, context.adminId, lock()), error => error.statusCode === 400);
  assert.deepEqual(context.events, []);
});

test('Lưu email lỗi không commit quyết định và không ngắt socket', async t => {
  const context = fixture(t, { queueError: true });
  await assert.rejects(updateUserStatus(context.adminId, context.userId, lock()), /Không lưu được hàng đợi/);
  assert.ok(!context.events.includes('commit'));
  assert.equal(context.disconnect.mock.callCount(), 0);
});

test('Thời hạn mới kiểm tra số nguyên, đơn vị, giới hạn và không trộn trường cũ', () => {
  const payload = lock({ durationDays: undefined, duration: 8, durationUnit: 'hours' });
  assert.ok(updateUserStatusSchema.safeParse(payload).success);
  assert.ok(updateUserStatusSchema.safeParse({ ...payload, duration: 30, durationUnit: 'days' }).success);
  assert.ok(updateUserStatusSchema.safeParse({ ...payload, duration: 87600 }).success);
  for (const override of [
    { duration: '8' }, { duration: 1.5 }, { duration: 0 }, { duration: -1 },
    { duration: 87601 }, { duration: 3651, durationUnit: 'days' },
    { durationUnit: 'minutes' }, { durationUnit: undefined }, { duration: undefined },
    { durationDays: 1 }, { penaltyType: 'PERMANENT_BAN' },
  ]) assert.equal(updateUserStatusSchema.safeParse({ ...payload, ...override }).success, false);
});

for (const [duration, durationUnit, hours, label] of [[8, 'hours', 8, '8 giờ'], [30, 'days', 720, '30 ngày']]) {
  test(`Khóa nhanh ${label} lưu đúng thời hạn và ghi đúng đơn vị trong email`, async t => {
    const context = fixture(t);
    await updateUserStatus(context.adminId, context.userId, lock({ durationDays: undefined, duration, durationUnit }));
    assert.equal(context.record.endAt - context.record.startAt, hours * 3600000);
    assert.equal(context.record.penalty.duration, duration);
    assert.equal(context.record.penalty.durationUnit, durationUnit);
    assert.equal(context.record.penalty.durationDays, durationUnit === 'days' ? duration : null);
    assert.ok(context.email.text.includes(`Thời hạn: ${label}`));
    assert.ok(context.email.text.includes(`Tạm khóa tài khoản ${label}`));
    assert.match(context.email.text, /Bạn sẽ được mở khóa tài khoản vào/);
    assert.equal(String(context.user.temporaryLockId), String(context.record._id));
  });
}
