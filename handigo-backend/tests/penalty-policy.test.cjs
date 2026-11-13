const { test } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');
const mongoose = require('mongoose');
const User = require('../src/models/user.model').default;
const { Violation } = require('../src/models/violation.model');
const { assertFeatureAllowed, getRestrictedUserIds, refreshTemporaryLock } = require('../src/services/penaltyPolicy.service');

const query = value => ({ select() { return this; }, session() { return this; }, lean() { return this; },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });

test('Hình phạt chat và tính năng dùng chung chặn đúng thao tác, không chặn chức năng khác', async t => {
  t.mock.method(Violation, 'find', filter => {
    assert.equal(filter.status, 'active');
    assert.equal(filter.isDeleted, false);
    assert.ok(filter.$and[1].$or[1].endAt.$gt instanceof Date);
    return query([{ userId: 'khach', penaltyType: 'RESTRICT_FEATURE', penalty: { feature: 'Trò chuyện' } }]);
  });
  await assert.rejects(assertFeatureAllowed('khach', 'chat'), error => error.statusCode === 403);
  await assert.doesNotReject(assertFeatureAllowed('khach', 'voucher'));
  assert.deepEqual(await getRestrictedUserIds('chat'), ['khach']);
  assert.deepEqual(await getRestrictedUserIds('order_receiving'), []);
});

test('Hình phạt chuyên biệt và tạm khóa chặn cả service được gọi từ HTTP hoặc socket', async t => {
  for (const [penaltyType, feature] of [['RESTRICT_CHAT', 'chat'], ['RESTRICT_VOUCHER', 'voucher'],
    ['RESTRICT_ORDER_RECEIVING', 'order_receiving'], ['TEMPORARY_SUSPEND', 'booking']]) {
    t.mock.method(Violation, 'find', () => query([{ penaltyType }]));
    await assert.rejects(assertFeatureAllowed('khach', feature), error => error.statusCode === 403);
  }
});

test('Vi phạm đã hết hiệu lực không chặn thao tác và truy vấn lọc thời hạn ngay tại database', async t => {
  t.mock.method(Violation, 'find', filter => {
    assert.ok(filter.$and[0].$or[1].startAt.$lte instanceof Date);
    assert.ok(filter.$and[1].$or[1].endAt.$gt instanceof Date);
    return query([]);
  });
  await assert.doesNotReject(assertFeatureAllowed('khach', 'chat'));
});

function lockFixture(t, { marker = true, activePenalty = false, future = false, changed = false } = {}) {
  const user = { _id: 'khach', status: 'locked', ...(marker ? { temporaryLockId: 'tam-khoa' } : {}) };
  const writes = [];
  t.mock.method(mongoose.connection, 'transaction', async work => work({}));
  t.mock.method(User, 'findOne', () => query(user));
  t.mock.method(User, 'findOneAndUpdate', (filter, update) => {
    assert.equal(filter.temporaryLockId, 'tam-khoa');
    return query(changed ? null : user);
  });
  t.mock.method(User, 'updateOne', async (_filter, update) => { writes.push(update); });
  t.mock.method(Violation, 'findOne', () => query({ status: 'active', endAt: new Date(Date.now() + (future ? 60000 : -60000)) }));
  t.mock.method(Violation, 'exists', () => query(activePenalty ? { _id: 'khoa-khac' } : null));
  t.mock.method(Violation, 'updateMany', async () => {});
  return { user, writes };
}

test('Hết hạn khóa tạm thời tự khôi phục tài khoản và xóa dấu nguồn khóa', async t => {
  const context = lockFixture(t);
  await refreshTemporaryLock('khach');
  assert.equal(context.user.status, 'active');
  assert.equal(context.writes[0].$unset.temporaryLockId, 1);
});

for (const [label, options] of [
  ['khóa thủ công hoặc bản ghi cũ không rõ nguồn', { marker: false }],
  ['còn hình phạt khóa khác', { activePenalty: true }],
  ['chưa hết thời hạn', { future: true }],
  ['nguồn khóa vừa bị thay đổi đồng thời', { changed: true }],
]) test(`Không mở nhầm tài khoản khi ${label}`, async t => {
  const context = lockFixture(t, options);
  await refreshTemporaryLock('khach');
  assert.equal(context.user.status, 'locked');
  assert.equal(context.writes.length, 0);
});

test('Dấu nguồn khóa không xuất hiện trong truy vấn hồ sơ mặc định', () => {
  assert.equal(User.schema.path('temporaryLockId').options.select, false);
});

for (const alreadyLocked of [false, true]) test(`Áp dụng khóa tạm thời ${alreadyLocked ? 'giữ nguồn khóa thủ công' : 'ghi dấu nguồn khóa mới'} và chỉ ngắt socket sau commit`, async t => {
  const { Report } = require('../src/models/report.model');
  const { Session } = require('../src/models/session.model');
  const socket = require('../src/sockets/socketServer');
  const { createViolation } = require('../src/services/violation.service');
  const userId = new mongoose.Types.ObjectId();
  const sourceId = new mongoose.Types.ObjectId();
  const violationId = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();
  const session = {};
  const events = [];
  const user = new User({ _id: userId, role: 'CUSTOMER', status: alreadyLocked ? 'locked' : 'active' });
  user.save = async options => { assert.equal(options.session, session); events.push('luu-tai-khoan'); };
  t.mock.method(mongoose.connection, 'transaction', async work => { const value = await work(session); events.push('commit'); return value; });
  t.mock.method(User, 'findOne', () => query(user));
  t.mock.method(User, 'findOneAndUpdate', () => query(user));
  t.mock.method(Report, 'findOneAndUpdate', () => query({ _id: sourceId, targetUserId: userId }));
  t.mock.method(Report, 'findByIdAndUpdate', async (_id, _update, options) => { assert.equal(options.session, session); });
  t.mock.method(Violation, 'create', async (items, options) => {
    assert.equal(options.session, session);
    assert.ok(items[0].endAt > new Date());
    return [{ _id: violationId }];
  });
  t.mock.method(Violation, 'findById', () => ({ populate: async () => ({ _id: violationId }) }));
  t.mock.method(Session, 'updateMany', async (_filter, _update, options) => { assert.equal(options.session, session); });
  t.mock.method(socket, 'disconnectUserSockets', () => events.push('ngat-socket'));
  await createViolation(String(adminId), { sourceType: 'REPORT', sourceId: String(sourceId),
    violationType: 'spam', severity: 'HIGH', reason: 'Gửi tin rác', adminDecision: 'Tạm khóa một ngày',
    penalty: { type: 'TEMPORARY_SUSPEND', durationDays: 1 } });
  assert.equal(user.status, 'locked');
  assert.equal(user.temporaryLockId?.toString(), alreadyLocked ? undefined : String(violationId));
  assert.ok(events.indexOf('commit') < events.indexOf('ngat-socket'));
});
