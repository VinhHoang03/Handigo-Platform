const { test } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');
const mongoose = require('mongoose');
const { buildViolationEmail } = require('../src/utils/violationEmail');
const { ViolationEmail } = require('../src/models/violationEmail.model');
const mail = require('../src/utils/mail');
const { enqueueViolationEmail, processViolationEmails } = require('../src/services/violationEmail.service');

function violation(type = 'WARNING') {
  return {
    _id: new mongoose.Types.ObjectId(), userId: new mongoose.Types.ObjectId(),
    violationType: 'Gửi tin nhắn quấy rối', severity: 'HIGH', penaltyType: type,
    reason: '<script>alert("x")</script> & lý do', adminDecision: 'Xử lý theo bằng chứng đã xác minh',
    penalty: { type, durationDays: 3, note: 'Ghi chú nội bộ không gửi' },
    startAt: new Date('2026-10-30T00:00:00Z'), endAt: new Date('2026-11-02T00:00:00Z'),
  };
}

test('Email cảnh cáo có đủ quyết định, mã tra cứu và escape nội dung HTML', () => {
  const item = violation();
  const email = buildViolationEmail(item, '<img src=x>', String(item._id));
  assert.match(email.subject, /Cảnh cáo/);
  for (const value of [String(item._id), item.violationType, item.reason, item.adminDecision, 'Cao']) {
    assert.ok(email.text.includes(value));
  }
  assert.match(email.text, /Quyết định cảnh cáo này không khóa tài khoản/);
  assert.ok(!email.html.includes('<script>'));
  assert.ok(!email.html.includes('<img'));
  assert.match(email.html, /&lt;script&gt;/);
  assert.ok(!email.text.includes(item.penalty.note));
});

test('Email tạm khóa ghi số ngày, giờ Việt Nam và điều kiện tự mở', () => {
  const email = buildViolationEmail(violation('TEMPORARY_SUSPEND'), 'Khách', 'ma');
  assert.match(email.subject, /Tạm khóa/);
  assert.match(email.text, /3 ngày/);
  assert.match(email.text, /02\/11\/2026/);
  assert.match(email.text, /07:00/);
  assert.match(email.text, /giờ Việt Nam/);
  assert.match(email.text, /Bạn sẽ được mở khóa tài khoản vào/);
  assert.match(email.text, /nếu không còn quyết định khóa khác/);
});

test('Email khóa vĩnh viễn không hứa tự mở hay có thời hạn', () => {
  const email = buildViolationEmail(violation('PERMANENT_BAN'), 'Khách', 'ma');
  assert.match(email.subject, /Khóa tài khoản vĩnh viễn/);
  assert.match(email.text, /không tự động mở lại/);
  assert.ok(!email.text.includes('Thời điểm hết hạn'));
  assert.ok(!email.text.includes('3 ngày'));
});

test('Hạn chế tính năng có nhãn tiếng Việt và không thông báo khóa toàn bộ tài khoản', () => {
  const item = violation('RESTRICT_FEATURE');
  item.penalty.feature = 'booking';
  const email = buildViolationEmail(item, 'Khách', 'ma');
  assert.match(email.text, /Đặt dịch vụ/);
  assert.ok(!email.text.includes('Bạn không thể đăng nhập'));
});

test('Hàng đợi lưu bản chụp email cùng session và không gọi SMTP trước commit', async t => {
  const item = violation();
  const session = {};
  const send = t.mock.method(mail, 'sendNotificationEmail', async () => {});
  const create = t.mock.method(ViolationEmail, 'create', async (items, options) => {
    assert.equal(options.session, session);
    assert.equal(items[0].to, 'khach@example.com');
    assert.equal(items[0].violationId, item._id);
    assert.equal(items[0].userId, item.userId);
    assert.match(items[0].text, /Cảnh cáo/);
  });
  await enqueueViolationEmail(item, { email: 'khach@example.com', fullName: 'Khách' }, session);
  assert.equal(create.mock.callCount(), 1);
  assert.equal(send.mock.callCount(), 0);
});

test('Tài khoản thiếu email không chặn quyết định và không tạo thư sai người nhận', async t => {
  t.mock.method(console, 'warn', () => {});
  const create = t.mock.method(ViolationEmail, 'create', async () => {});
  await enqueueViolationEmail(violation(), {}, {});
  assert.equal(create.mock.callCount(), 0);
});

function worker(t, attempts, sendError = false) {
  const job = { _id: new mongoose.Types.ObjectId(), violationId: new mongoose.Types.ObjectId(),
    to: 'khach@example.com', subject: 'Thông báo', text: 'Nội dung', html: '<p>Nội dung</p>', attempts };
  const updates = [];
  let claimed = false;
  let leaseId;
  t.mock.method(console, 'warn', () => {});
  t.mock.method(ViolationEmail, 'updateMany', async () => {});
  t.mock.method(ViolationEmail, 'findOneAndUpdate', async (filter, update, options) => {
    assert.deepEqual(filter.status.$in, ['pending', 'processing']);
    assert.equal(filter.attempts.$lt, 5);
    assert.ok(filter.nextAttemptAt.$lte instanceof Date);
    assert.equal(options.new, true);
    assert.equal(options.runValidators, true);
    assert.equal(update.$inc.attempts, 1);
    if (claimed) return null;
    claimed = true;
    leaseId = update.$set.leaseId;
    return job;
  });
  t.mock.method(ViolationEmail, 'updateOne', async (filter, update) => {
    assert.equal(filter.leaseId, leaseId);
    assert.equal(filter.status, 'processing');
    updates.push(update.$set);
  });
  const send = t.mock.method(mail, 'sendNotificationEmail', async message => {
    assert.equal(message.to, job.to);
    assert.ok(message.messageId.includes(String(job.violationId)));
    if (sendError) throw new Error('Lỗi SMTP giả lập');
  });
  return { updates, send };
}

test('Gửi thành công ghi trạng thái sent theo đúng lease', async t => {
  const context = worker(t, 1);
  await processViolationEmails();
  assert.equal(context.send.mock.callCount(), 1);
  assert.equal(context.updates[0].status, 'sent');
  assert.ok(context.updates[0].sentAt instanceof Date);
});

test('SMTP lỗi lên lịch thử lại và không báo gửi thành công', async t => {
  const context = worker(t, 2, true);
  await processViolationEmails();
  assert.equal(context.updates[0].status, 'pending');
  assert.ok(context.updates[0].nextAttemptAt > new Date(Date.now() + 110000));
  assert.equal(context.updates[0].leaseId, null);
});

test('SMTP lỗi ở lần cuối đánh dấu failed để kiểm tra vận hành', async t => {
  const context = worker(t, 5, true);
  await processViolationEmails();
  assert.equal(context.updates[0].status, 'failed');
});

test('Không có công việc khả dụng thì không gửi email', async t => {
  t.mock.method(ViolationEmail, 'updateMany', async filter => {
    assert.equal(filter.attempts.$gte, 5);
    assert.equal(filter.status, 'processing');
  });
  t.mock.method(ViolationEmail, 'findOneAndUpdate', async () => null);
  const send = t.mock.method(mail, 'sendNotificationEmail', async () => {});
  await processViolationEmails();
  assert.equal(send.mock.callCount(), 0);
});

for (const type of ['WARNING', 'TEMPORARY_SUSPEND', 'PERMANENT_BAN']) {
  test(`Tạo vi phạm ${type} lưu email cùng quyết định trước commit và không gửi trực tiếp`, async t => {
    const User = require('../src/models/user.model').default;
    const { Report } = require('../src/models/report.model');
    const { Session } = require('../src/models/session.model');
    const { Violation } = require('../src/models/violation.model');
    const socket = require('../src/sockets/socketServer');
    const { createViolation } = require('../src/services/violation.service');
    const item = violation(type);
    const user = new User({ _id: item.userId, role: 'CUSTOMER', status: 'active',
      email: 'chu-tai-khoan@example.com', fullName: 'Chủ tài khoản' });
    const session = {};
    const events = [];
    const query = value => ({ select() { return this; }, session() { return this; },
      then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
    t.mock.method(mongoose.connection, 'transaction', async work => {
      const result = await work(session); events.push('commit'); return result;
    });
    t.mock.method(User, 'findOne', () => query(user));
    t.mock.method(User, 'findOneAndUpdate', () => query(user));
    user.save = async () => {};
    t.mock.method(Report, 'findOneAndUpdate', () => query({ targetUserId: item.userId }));
    t.mock.method(Report, 'findByIdAndUpdate', async () => { events.push('nguon'); });
    t.mock.method(Session, 'updateMany', async () => {});
    t.mock.method(socket, 'disconnectUserSockets', () => {});
    t.mock.method(Violation, 'create', async (items, options) => {
      assert.equal(options.session, session);
      events.push('vi-pham');
      return [{ ...items[0], _id: item._id }];
    });
    t.mock.method(Violation, 'findById', () => ({ populate: async () => item }));
    t.mock.method(ViolationEmail, 'create', async (items, options) => {
      assert.equal(options.session, session);
      assert.equal(items[0].to, user.email);
      assert.match(items[0].text, /Chủ tài khoản/);
      events.push('email');
    });
    const send = t.mock.method(mail, 'sendNotificationEmail', async () => {});
    await createViolation(String(new mongoose.Types.ObjectId()), {
      sourceType: 'REPORT', sourceId: String(new mongoose.Types.ObjectId()),
      violationType: item.violationType, severity: item.severity, reason: item.reason,
      adminDecision: item.adminDecision, penalty: item.penalty,
    });
    assert.deepEqual(events, ['vi-pham', 'email', 'nguon', 'commit']);
    assert.equal(send.mock.callCount(), 0);
  });
}

test('Lỗi lưu hàng đợi được truyền ra transaction để hủy cả quyết định, không gửi SMTP', async t => {
  t.mock.method(ViolationEmail, 'create', async () => { throw new Error('Không lưu được hàng đợi'); });
  const send = t.mock.method(mail, 'sendNotificationEmail', async () => {});
  await assert.rejects(enqueueViolationEmail(violation(), { email: 'khach@example.com' }, {}), /Không lưu được hàng đợi/);
  assert.equal(send.mock.callCount(), 0);
});
