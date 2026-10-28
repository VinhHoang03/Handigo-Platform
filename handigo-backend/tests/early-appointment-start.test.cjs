const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { Types } = require('mongoose');

const now = Date.parse('2026-10-15T10:00:00+07:00');
class TestDate extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
}

// Nạp mã thật với database giả lập, không đọc cấu hình bí mật hoặc kết nối mạng.
function load(relativePath, modules = {}, currentTime = now) {
  const file = path.join(__dirname, '../src', relativePath);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, Date: class extends TestDate {
      constructor(...args) { super(...(args.length ? args : [currentTime])); }
      static now() { return currentTime; }
    }, Map, Set,
    require: name => modules[name] ?? {},
  }, { filename: file });
  return exports;
}

const query = value => ({
  select() { return this; }, session() { return this; },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
});

function setup(overrides = {}, { activeOrder = false, owned = true, otherOrders = [], policyOverrides = {}, currentTime = now } = {}) {
  const loadModule = (file, modules) => load(file, modules, currentTime);
  let saves = 0;
  const events = [];
  const provider = { _id: new Types.ObjectId(), async save() { saves++; } };
  const order = {
    _id: new Types.ObjectId(), customerId: new Types.ObjectId(), providerId: provider._id, serviceId: new Types.ObjectId(),
    status: 'accepted', orderType: 'scheduled', bookingStatus: 'confirmed',
    inspectionRequired: false, paymentMethod: 'cash', paymentStatus: 'unpaid',
    scheduledAt: new Date('2026-10-15T14:00:00+07:00'), selectedOptionsSnapshot: [],
    schedule: { durationMinutes: 60, bufferMinutes: 15, travelMinutes: 30 },
    toObject() { return { ...this }; }, async save() { saves++; },
    ...overrides,
  };
  // Lịch hẹn 14:00 hợp lệ, nhưng bắt đầu sớm lúc 10:00 nằm ngoài ca dự kiến.
  const policy = {
    defaultDurationMinutes: 60, inspectionDurationMinutes: 60,
    bufferMinutes: 15, travelMinutes: 30, workdayStart: 12 * 60, workdayEnd: 18 * 60,
    services: {}, options: {}, providerCalendars: {}, ...policyOverrides,
  };
  const session = { async withTransaction(fn) {
    const result = await fn(); events.push('commit'); return result;
  }, async endSession() {} };
  const booking = loadModule('utils/bookingPolicy.ts');
  const intervals = loadModule('utils/providerSchedule.ts', { './bookingPolicy': booking });
  const modules = {
    mongoose: { __esModule: true, default: { startSession: async () => session }, Types },
    '../models/order.model': { Order: {
      findOne: () => query(owned ? order : null),
      exists: () => query(activeOrder), find: () => query(otherOrders.map(other => ({ ...order, ...other, providerId: provider._id }))),
    } },
    '../models/provider.model': { Provider: {
      findOne: () => query(provider), findOneAndUpdate: (_filter, _update, options) => {
        assert.equal(options.returnDocument, 'after');
        assert.equal(options.runValidators, true);
        assert.equal(options.session, session);
        assert.equal(Object.hasOwn(options, 'new'), false);
        return query(provider);
      },
    } },
    '../models/repairQuotation.model': { RepairQuotation: {
      findOne: () => query({ status: 'saved', estimatedDurationMinutes: 60 }),
    } },
    '../utils/appError': { AppError: Error },
    '../sockets/socketServer': { emitToUser(userId, event, payload) { events.push({ userId, event, payload }); } },
    '../utils/bookingPolicy': booking, '../utils/providerSchedule': intervals,
    './systemConfig.service': { getBookingPolicy: async () => policy },
  };
  modules['./providerSchedule.service'] = loadModule('services/providerSchedule.service.ts', modules);
  const { OrderService } = loadModule('services/order.service.ts', modules);
  return {
    order, provider, events, saves: () => saves,
    start: () => OrderService.startOrder(String(order._id), String(new Types.ObjectId())),
  };
}

for (const paymentMethod of ['cash', 'wallet', 'bank']) {
  test(`Lịch hẹn giá cố định ${paymentMethod}: bắt đầu trước giờ hẹn và trước ca làm việc`, async () => {
    const context = setup({ paymentMethod, paymentStatus: paymentMethod === 'cash' ? 'unpaid' : 'paid' });
    const order = await context.start();
    assert.equal(order.status, 'in_progress');
    assert.equal(context.provider.availabilityStatus, 'busy');
    assert.equal(order.schedule.expectedStartAt.getTime(), now);
    assert.equal(order.schedule.expectedEndAt.getTime(), now + 60 * 60000);
    assert.equal(order.scheduledAt.getTime(), Date.parse('2026-10-15T14:00:00+07:00'));
    assert.equal(context.saves(), 2);
    assert.equal(context.events[0], 'commit');
    assert.equal(context.events[1].userId, order.customerId.toString());
    assert.equal(context.events[1].event, 'order:updated');
    assert.equal(context.events[1].payload.orderId, order._id.toString());
  });
}

test('App chưa có bước đến nơi vẫn bắt đầu đơn theo luồng cũ', async () => {
  const context = setup({ arrival: null });
  const order = await context.start();
  assert.equal(order.status, 'in_progress');
  assert.equal(context.saves(), 2);
});

for (const [name, overrides, options, error] of [
  ['báo khách vắng mặt đang chờ duyệt', { customerNoShow: { status: 'pending' } }, {}, /đang chờ xử lý/],
  ['đang thực hiện đơn khác', {}, { activeOrder: true }, /Bạn đang thực hiện một đơn khác/],
  ['không thuộc thợ', {}, { owned: false }, /Đơn không thuộc về bạn/],
  ['lịch chưa xác nhận', { bookingStatus: 'reserved' }, {}, /Lịch hẹn chưa được thanh toán và xác nhận/],
  ['chưa thanh toán trực tuyến', { paymentMethod: 'bank' }, {}, /Đơn chưa được thanh toán thành công/],
  ['chưa trả cọc khảo sát', { inspectionRequired: true }, {}, /Tiền cọc chưa được thanh toán/],
  ['khảo sát trùng đơn đã nhận', { inspectionRequired: true, depositPaidAt: new Date(now) }, { otherOrders: [{ status: 'accepted', scheduledAt: new Date(now) }] }, /bị trùng với đơn khác/],
]) {
  test(`Giữ điều kiện chặn khi ${name}`, async () => {
    const context = setup(overrides, options);
    await assert.rejects(context.start, error);
    assert.equal(context.saves(), 0);
    assert.equal(context.events.length, 0);
  });
}

for (const [name, overrides] of [
  ['khảo sát đã trả cọc và có báo giá', { inspectionRequired: true, depositPaidAt: new Date(now) }],
  ['đơn thường', { orderType: 'normal' }],
  ['lịch định kỳ', { orderType: 'recurring' }],
  ['đúng giờ hẹn', { scheduledAt: new Date(now) }],
  ['muộn giờ hẹn', { scheduledAt: new Date(now - 3600000) }],
  ['dữ liệu cũ không có giờ hẹn', { scheduledAt: null }],
]) {
  test(`Bắt đầu ngoài ca: ${name}`, async () => {
    const context = setup(overrides);
    assert.equal((await context.start()).status, 'in_progress');
    assert.equal(context.saves(), 2);
  });
}

test('Ca đã kết thúc vẫn bắt đầu đơn đã nhận nếu không trùng lịch', async () => {
  const context = setup({ scheduledAt: new Date(now - 3600000) }, {
    policyOverrides: { workdayStart: 8 * 60, workdayEnd: 9 * 60 },
  });
  assert.equal((await context.start()).status, 'in_progress');
});

test('Bắt đầu lúc 23:26 không bị chặn bởi ca làm việc đã kết thúc', async () => {
  const currentTime = Date.parse('2026-10-15T23:26:17+07:00');
  const context = setup({}, { currentTime });
  const order = await context.start();
  assert.equal(order.status, 'in_progress');
  assert.equal(order.schedule.expectedStartAt.getTime(), currentTime);
  assert.equal(order.schedule.expectedEndAt.getTime(), currentTime + 60 * 60000);
});

for (const paymentMethod of ['cash', 'wallet', 'bank']) {
  for (const orderType of ['normal', 'scheduled']) {
    test(`Giá cố định ${orderType}/${paymentMethod}: lịch đơn chưa làm không chặn bắt đầu lúc 23:50`, async () => {
      const currentTime = Date.parse('2026-10-15T23:50:51+07:00');
      const context = setup({ orderType, paymentMethod, paymentStatus: paymentMethod === 'cash' ? 'unpaid' : 'paid' }, {
        currentTime,
        otherOrders: [{ status: 'accepted', scheduledAt: new Date('2026-10-15T14:00:00+07:00') }],
      });
      const order = await context.start();
      assert.equal(order.status, 'in_progress');
      assert.equal(order.schedule.expectedStartAt.getTime(), currentTime);
      assert.equal(context.saves(), 2);
    });
  }
  test(`Giá cố định ${paymentMethod}: vẫn chặn khi thợ đang thực hiện đơn khác`, async () => {
    const context = setup({ paymentMethod, paymentStatus: paymentMethod === 'cash' ? 'unpaid' : 'paid' }, { activeOrder: true });
    await assert.rejects(context.start, /Bạn đang thực hiện một đơn khác/);
    assert.equal(context.saves(), 0);
  });
}
