const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Chạy service thật với database giả; không kết nối dịch vụ hay đọc cấu hình bí mật.
function setup() {
  let clock = Date.now();
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return clock; } }
  const order = { _id: 'order', orderCode: 'HD-001', customerId: 'customer', providerId: 'provider', status: 'accepted', isDeleted: false };
  const notices = [], emissions = [], locations = [];
  const errors = [];
  let movement;
  let role = 'PROVIDER';
  let committed = false, failNotification = false;
  const query = value => ({ select() { return this; }, session() { return this; }, lean: async () => structuredClone(value) });
  const matches = filter => Object.entries(filter).every(([key, value]) => order[key] === value);
  const session = { async endSession() {} };
  const modules = {
    mongoose: { startSession: async () => session },
    '../models/order.model': { Order: {
      find: filter => query(matches(filter) ? [order] : []),
      findOne: filter => query(matches(filter) ? order : null),
      async updateOne(filter, update, options) {
        assert.equal(options.session, session);
        assert.equal(options.runValidators, true);
        assert.ok(matches(filter));
        Object.assign(order, structuredClone(update.$set));
        return { modifiedCount: 1 };
      },
    } },
    '../models/provider.model': { Provider: { findOne: filter => query(
      filter.userId === 'worker' && filter.verified && !filter.isDeleted ? { _id: order.providerId }
        : filter._id === order.providerId && !filter.isDeleted ? { userId: 'worker' } : null) } },
    '../models/location.model': { Location: { findOneAndUpdate: (filter, update) => ({ lean: async () => {
      locations.push({ user: filter.userId, coordinates: update.coordinates });
      return { lastUpdatedAt: new Clock() };
    } }) } }, '../models/address.model': {},
    '../models/user.model': { default: { findById: () => query({ role }) } },
    '../utils/logger': { createLogger: () => ({ error(message) { errors.push(message); } }) },
    '../sockets/socketServer': { publishProviderLocationChanged: async () => {} },
    '../utils/appError': { AppError: Error },
    './location.service': { async updateCurrentLocation(user, payload) {
      locations.push({ user, payload });
      await movement.detectProviderMovementFromLocation(user, payload);
      return { lastUpdatedAt: new Clock() };
    } },
    './routing.service': {},
    './matching.service': { haversineMeters: (lat1, lon1, lat2, lon2) => {
      const rad = Math.PI / 180;
      const a = Math.sin((lat2 - lat1) * rad / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lon2 - lon1) * rad / 2) ** 2;
      return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    } },
    '../utils/transaction': { async withTransactionRetry(actualSession, run) {
      assert.equal(actualSession, session);
      const previous = structuredClone(order), length = notices.length;
      committed = false;
      try { const result = await run(); committed = true; return result; }
      catch (error) {
        for (const key of Object.keys(order)) delete order[key];
        Object.assign(order, previous); notices.length = length; throw error;
      }
    } },
    './notification.service': {
      async createNotificationRecord(input, options) {
        assert.equal(options.session, session);
        assert.equal(options.deferRealtime, true);
        if (failNotification) throw new Error('Lỗi lưu thông báo giả lập');
        const notification = { id: `notice-${notices.length}`, ...input };
        notices.push(notification); return notification;
      },
      emitRealtimeNotification(notification) {
        assert.equal(committed, true, 'Chỉ phát sau khi giao dịch đã commit');
        emissions.push(notification);
      },
    },
  };
  function load(file) {
    const filename = path.join(__dirname, '../src', file);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const exports = {};
    vm.runInNewContext(source, { exports, Date: Clock, require(name) {
      assert.ok(name in modules, `Module chưa được giả lập: ${name}`); return modules[name];
    } }, { filename });
    return exports;
  }
  movement = load('services/providerMovement.service.ts');
  modules['./providerMovement.service'] = movement;
  const locationService = load('services/location.service.ts');
  const exports = load('services/orderTracking.service.ts');
  modules.zod = require('zod');
  const { currentLocationSchema } = load('validations/location.validator.ts');
  const send = (meters, overrides = {}) => exports.updateOrderTrackingLocation('order', 'worker', 'PROVIDER', {
    latitude: meters / 111194.9266, longitude: 0, accuracy: 10, capturedAt: clock, ...overrides,
  });
  return { order, notices, emissions, locations, send, service: exports, errors,
    sendHttp(meters, overrides = {}) {
      return locationService.updateCurrentLocation('worker', currentLocationSchema.parse({
        latitude: meters / 111194.9266, longitude: 0, accuracy: 10, capturedAt: clock, ...overrides,
      }));
    },
    setRole(value) { role = value; },
    advance(ms = 10000) { clock += ms; }, fail(value) { failNotification = value; }, now() { return clock; } };
}

test('Chỉ thông báo sau hai mẫu liên tiếp vượt 200 m; phát realtime đúng khách và không lặp', async () => {
  const s = setup();
  await s.send(0); s.advance(); await s.send(150);
  assert.equal(s.notices.length, 0);
  s.advance(); await s.send(220);
  assert.equal(s.notices.length, 0);
  s.advance(); await s.send(240);
  assert.equal(s.notices.length, 1); assert.equal(s.emissions.length, 1);
  assert.equal(s.emissions[0].userId, 'customer');
  assert.equal(s.emissions[0].data.orderId, 'order');
  assert.equal(s.emissions[0].data.action, 'provider_started_moving');
  assert.ok(s.order.movementTracking.notifiedAt);
  s.advance(); await s.send(500); s.advance(); await s.send(700);
  assert.equal(s.notices.length, 1);
});

test('App gửi GPS qua HTTP kích hoạt đúng một thông báo cho khách của đơn', async () => {
  const s = setup();
  await s.sendHttp(0); s.advance(15000); await s.sendHttp(220);
  assert.equal(s.notices.length, 0);
  s.advance(15000); await s.sendHttp(250);
  assert.equal(s.notices.length, 1);
  assert.equal(s.emissions[0].userId, 'customer');
  assert.equal(s.emissions[0].data.action, 'provider_started_moving');
  assert.equal(s.emissions[0].data.orderId, 'order');
  s.advance(15000); await s.sendHttp(300);
  assert.equal(s.notices.length, 1);
  assert.equal(s.locations.length, 4);
});

test('HTTP và socket dùng chung dấu xác nhận, không gửi hai thông báo', async () => {
  const s = setup();
  await s.sendHttp(0); s.advance(); await s.send(220);
  s.advance(); await s.sendHttp(250); s.advance(); await s.send(300);
  assert.equal(s.notices.length, 1);
});

test('App cũ không gửi metadata hoặc GPS sai số 127 m vẫn lưu vị trí nhưng chưa báo di chuyển', async () => {
  const s = setup();
  for (const overrides of [{ accuracy: undefined, capturedAt: undefined }, { accuracy: 127 },
    { capturedAt: s.now() - 31000 }, { capturedAt: s.now() + 6000 }]) {
    await s.sendHttp(0, overrides);
    s.advance(); await s.sendHttp(250, overrides);
    s.advance(); await s.sendHttp(270, overrides);
  }
  assert.equal(s.locations.length, 12);
  assert.equal(s.order.movementTracking, undefined);
  assert.equal(s.notices.length, 0);
});

test('GPS HTTP không báo khi không còn đơn accepted hoặc đã đến nơi', async () => {
  for (const status of ['in_progress', 'completed', 'cancelled']) {
    const s = setup(); s.order.status = status;
    await s.sendHttp(0); s.advance(); await s.sendHttp(250); s.advance(); await s.sendHttp(300);
    assert.equal(s.notices.length, 0);
  }
  const s = setup(); s.order.arrival = { providerId: 'provider' };
  await s.sendHttp(0); s.advance(); await s.sendHttp(250); s.advance(); await s.sendHttp(300);
  assert.equal(s.notices.length, 0);
});

test('Lỗi thông báo không làm thất bại lưu GPS; mẫu sau có thể thử lại', async () => {
  const s = setup(); await s.sendHttp(0); s.advance(); await s.sendHttp(220);
  s.fail(true); s.advance(); await s.sendHttp(250);
  assert.equal(s.locations.length, 3);
  assert.equal(s.errors.length, 1);
  assert.equal(s.order.movementTracking.notifiedAt, null);
  s.fail(false); s.advance(); await s.sendHttp(270);
  assert.equal(s.notices.length, 1);
});

test('Validation HTTP từ chối metadata sai định dạng trước khi lưu', () => {
  const s = setup();
  for (const overrides of [{ accuracy: -1 }, { accuracy: '10' }, { accuracy: Infinity }, { capturedAt: -1 }, { capturedAt: 'now' }]) {
    assert.throws(() => s.sendHttp(0, overrides));
  }
  assert.equal(s.locations.length, 0);
});

test('GPS sai số lớn, thiếu thông tin, mẫu cũ hoặc trong tương lai không làm mốc', async () => {
  const s = setup();
  for (const overrides of [{ accuracy: 80 }, { accuracy: undefined }, { accuracy: -1 },
    { accuracy: NaN }, { capturedAt: undefined }, { capturedAt: s.now() - 31000 }, { capturedAt: s.now() + 6000 }]) {
    await s.send(0, overrides);
    assert.equal(s.order.movementTracking, undefined);
  }
  assert.equal(s.locations.length, 7, 'GPS cũ vẫn tương thích luồng vị trí hiện có');
  assert.equal(s.emissions.length, 0);
});

test('GPS nhảy xa rồi trở lại gần mốc phải bắt đầu xác nhận lại', async () => {
  const s = setup();
  await s.send(0); s.advance(); await s.send(300); s.advance(); await s.send(30);
  assert.equal(s.order.movementTracking.confirmationStartedAt, null);
  s.advance(); await s.send(250);
  assert.equal(s.notices.length, 0);
  s.advance(); await s.send(260); assert.equal(s.notices.length, 1);
});

test('Hai tab gửi cùng mẫu hoặc mẫu dồn sau mất kết nối không xác nhận di chuyển', async () => {
  const s = setup();
  await s.send(0); s.advance(); await s.send(250);
  await s.send(260); s.advance(1000); await s.send(270);
  assert.equal(s.notices.length, 0);
  s.advance(9000); await s.send(270); assert.equal(s.notices.length, 1);
});

test('Sau khoảng mất GPS hơn 60 giây phải xác nhận lại', async () => {
  const s = setup(); await s.send(0); s.advance(); await s.send(250);
  s.advance(61000); await s.send(300); assert.equal(s.notices.length, 0);
  s.advance(); await s.send(320); assert.equal(s.notices.length, 1);
});

test('Mốc được lưu trong database, không phụ thuộc vòng đời trang hay socket', async () => {
  const s = setup(); await s.send(0); s.advance(); await s.send(220);
  assert.equal(s.order.movementTracking.latitude, 0);
  s.advance(); await s.service.updateOrderTrackingLocation('order', 'worker', 'PROVIDER', {
    latitude: 0.0022, longitude: 0, accuracy: 10, capturedAt: s.now(),
  });
  assert.equal(s.notices.length, 1);
});

test('Đổi thợ làm mốc mới; thợ cũ không được gửi vị trí', async () => {
  const s = setup(); await s.send(0); s.advance(); await s.send(230); s.advance(); await s.send(250);
  s.order.providerId = 'replacement';
  s.advance(); await s.send(1000);
  assert.equal(s.order.movementTracking.providerId, 'replacement');
  assert.equal(s.order.movementTracking.notifiedAt, null);
  s.advance(); await s.send(1220); s.advance(); await s.send(1240);
  assert.equal(s.notices.length, 2);
  await assert.rejects(s.service.updateOrderTrackingLocation('order', 'old-worker', 'PROVIDER', { latitude: 0, longitude: 0 }));
});

test('Không thông báo khi đã đến nơi hoặc đã bắt đầu làm dịch vụ', async () => {
  for (const arrived of [true, false]) {
    const s = setup(); await s.send(0);
    if (arrived) s.order.arrival = { providerId: 'provider' };
    else s.order.status = 'in_progress';
    s.advance(); await s.send(250); s.advance(); await s.send(300);
    assert.equal(s.emissions.length, 0);
  }
});

test('Khách, thợ không phụ trách, đơn đã hủy và đơn đã xóa không được cập nhật', async () => {
  const s = setup();
  await assert.rejects(s.service.updateOrderTrackingLocation('order', 'customer', 'CUSTOMER', { latitude: 0, longitude: 0 }));
  await assert.rejects(s.service.updateOrderTrackingLocation('order', 'other', 'PROVIDER', { latitude: 0, longitude: 0 }));
  s.order.status = 'cancelled'; await assert.rejects(s.send(0));
  s.order.status = 'accepted'; s.order.isDeleted = true; await assert.rejects(s.send(0));
  assert.equal(s.locations.length, 0);
});

test('Lưu thông báo thất bại phải rollback dấu đã thông báo, lần sau thử lại được', async () => {
  const s = setup(); await s.send(0); s.advance(); await s.send(230);
  s.fail(true); s.advance(); await assert.rejects(s.send(240));
  assert.equal(s.order.movementTracking.notifiedAt, null); assert.equal(s.emissions.length, 0);
  s.fail(false); s.advance(); await s.send(260);
  assert.equal(s.notices.length, 1); assert.equal(s.emissions.length, 1);
});
