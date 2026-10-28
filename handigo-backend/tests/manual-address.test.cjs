const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { Types } = require('mongoose');
class AppError extends Error { constructor(message, statusCode) { super(message); this.statusCode = statusCode; } }
const payload = { recipientName: 'Nguyễn Văn An', recipientPhone: '0900000000', fullAddress: '12 Đường A, Phường B, Thành phố C', province: 'Thành phố C', ward: 'Phường B', isDefault: true };
const owner = new Types.ObjectId().toString();
const query = value => ({ select() { return this; }, sort() { return this; }, session() { return this; },
  lean: async () => value, then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) });

function setup({ geocodeError, existing, deleted = false } = {}) {
  const writes = [];
  let geocodes = 0;
  let saved;
  const current = existing ? { _id: new Types.ObjectId(), userId: owner, ...payload, latitude: 10, longitude: 106,
    placeId: 'ghim-cu', isDeleted: deleted, updatedAt: new Date(), toObject() { return { ...this }; } } : null;
  const filename = path.join(__dirname, '../src/services/address.service.ts');
  const exports = {};
  const modules = {
    mongoose: { __esModule: true, default: { connection: { transaction: work => work({}) } }, Types },
    'node:crypto': require('node:crypto'), '../utils/appError': { AppError },
    '../utils/actionPreconditionError': { ActionPreconditionError: Error },
    '../models/user.model': { __esModule: true, default: { updateOne: async () => ({ matchedCount: 1 }) } },
    './agentAddressResolver.service': { AGENT_AREA_PLACE_PREFIX: 'agent-area:' },
    './reverseGeocoding.service': { geocodeSavedAddress: async () => {
      geocodes++; if (geocodeError) throw geocodeError; return { latitude: 11, longitude: 107 };
    } },
    '../models/address.model': { Address: {
      findOne: filter => { assert.equal(filter.userId, owner); return query(current); },
      find: () => query(current && deleted ? [current] : []),
      updateMany: async () => {},
      create: async ([value]) => { writes.push(value); saved = { _id: new Types.ObjectId(), ...value }; return [saved]; },
      findOneAndUpdate: async (filter, update, options) => {
        assert.equal(filter.userId, owner); assert.equal(options.runValidators, true);
        writes.push(update); saved = { ...current, ...update.$set };
        for (const key of Object.keys(update.$unset ?? {})) delete saved[key];
        return saved;
      },
    } },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, { exports, require: name => modules[name] ?? {}, Date, Object, Error }, { filename });
  return { service: exports, current, writes, geocodes: () => geocodes, saved: () => saved };
}

test('Nhập địa chỉ tay vẫn lưu được khi không tìm thấy tọa độ, dịch vụ lỗi hoặc chưa cấu hình bản đồ', async () => {
  for (const status of [422, 503]) {
    const runtime = setup({ geocodeError: new AppError('Chưa tra được tọa độ', status) });
    const saved = await runtime.service.createAddress(owner, payload);
    assert.equal(saved.fullAddress, payload.fullAddress);
    assert.equal(saved.userId, owner);
    assert.equal(saved.isDefault, true);
    assert.equal(saved.latitude, undefined);
    assert.equal(saved.longitude, undefined);
    assert.equal(saved.placeId, undefined);
    assert.equal(runtime.writes.length, 1);
  }
});

test('Địa chỉ nhập tay tự có tọa độ khi tra cứu thành công; ghim hợp lệ không gọi dịch vụ tra cứu', async () => {
  const manual = setup();
  const saved = await manual.service.createAddress(owner, payload);
  assert.equal(saved.latitude, 11);
  assert.equal(saved.longitude, 107);
  const pin = setup({ geocodeError: new Error('Không được gọi tra cứu') });
  const withPin = await pin.service.createAddress(owner, { ...payload, latitude: 12, longitude: 108, placeId: 'ghim-moi' });
  assert.equal(pin.geocodes(), 0);
  assert.equal(withPin.placeId, 'ghim-moi');
});

test('Sửa địa chỉ bằng tay mà chưa tra được vị trí phải xóa ghim cũ, không giữ tọa độ của địa chỉ trước', async () => {
  const runtime = setup({ existing: true, geocodeError: new AppError('Chưa tìm thấy vị trí mới', 422) });
  const saved = await runtime.service.updateAddress(String(runtime.current._id), owner, { fullAddress: '99 Đường D, Phường B, Thành phố C' });
  assert.equal(saved.fullAddress, '99 Đường D, Phường B, Thành phố C');
  for (const field of ['latitude', 'longitude', 'placeId']) {
    assert.equal(field in saved, false);
    assert.equal(runtime.writes[0].$unset[field], 1);
    assert.equal(field in runtime.writes[0].$set, false);
  }
});

test('Khôi phục địa chỉ đã xóa khi dịch vụ bản đồ lỗi không mang lại ghim cũ', async () => {
  const runtime = setup({ existing: true, deleted: true, geocodeError: new AppError('Dịch vụ bản đồ lỗi', 503) });
  const saved = await runtime.service.createAddress(owner, payload);
  assert.equal(saved.isDeleted, false);
  assert.equal(saved.latitude, undefined);
  assert.equal(saved.placeId, undefined);
});

test('Chỉ sửa người nhận giữ nguyên vị trí hiện có', async () => {
  const runtime = setup({ existing: true, geocodeError: new Error('Không được tra cứu lại') });
  const saved = await runtime.service.updateAddress(String(runtime.current._id), owner, { recipientName: 'Nguyễn Văn Bình' });
  assert.equal(saved.latitude, 10);
  assert.equal(saved.longitude, 106);
  assert.equal(saved.placeId, 'ghim-cu');
  assert.equal(runtime.geocodes(), 0);
});

test('Xác nhận lại ghim trùng vị trí cũ vẫn giữ tọa độ khi sửa phần chữ của địa chỉ', async () => {
  const runtime = setup({ existing: true, geocodeError: new Error('Không được ghi đè ghim khách đã xác nhận') });
  const saved = await runtime.service.updateAddress(String(runtime.current._id), owner, {
    fullAddress: '12 Đường A, Tòa nhà mới, Phường B, Thành phố C', latitude: 10, longitude: 106,
  });
  assert.equal(saved.latitude, 10);
  assert.equal(saved.longitude, 106);
  assert.equal(runtime.geocodes(), 0);
});

test('API tìm vị trí từ địa chỉ yêu cầu đăng nhập, giới hạn tần suất và kiểm tra dữ liệu đầu vào', () => {
  const routes = fs.readFileSync(path.join(__dirname, '../src/routes/location.routes.ts'), 'utf8');
  const authentication = routes.indexOf('router.use(authMiddleware)');
  const geocode = routes.indexOf('router.post("/geocode"');
  assert.ok(authentication >= 0 && geocode > authentication);
  assert.match(routes.slice(geocode, geocode + 130), /routingRateLimit, validate\(geocodeAddressSchema\)/);
});

test('Tọa độ thiếu một phần, ngoài phạm vi hoặc lỗi lập trình vẫn bị từ chối', async () => {
  for (const coordinates of [{ latitude: 10 }, { longitude: 106 }, { latitude: 100, longitude: 106 }]) {
    const runtime = setup();
    await assert.rejects(runtime.service.createAddress(owner, { ...payload, ...coordinates }), /kinh độ và vĩ độ hợp lệ/);
    assert.equal(runtime.writes.length, 0);
  }
  const unexpected = setup({ geocodeError: new Error('Lỗi ngoài dịch vụ bản đồ') });
  await assert.rejects(unexpected.service.createAddress(owner, payload), /Lỗi ngoài dịch vụ bản đồ/);
  assert.equal(unexpected.writes.length, 0);
});

test('Lưu địa chỉ không có tọa độ vẫn giữ bước tra cứu chính xác trước khi tìm thợ', async () => {
  const runtime = setup({ geocodeError: new AppError('Chưa tra được tọa độ', 422) });
  const saved = await runtime.service.createAddress(owner, payload);
  await assert.rejects(runtime.service.ensureAddressCoordinates(saved), /Chưa tra được tọa độ/);
  assert.equal(runtime.writes.length, 1);
});
