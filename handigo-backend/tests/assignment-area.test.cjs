const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, modules = {}) {
  const exports = {};
  const filename = path.join(__dirname, '../src', file);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, { exports, console, Date,
    require: name => name in modules ? modules[name] : name.startsWith('.') ? {} : require(name) }, { filename });
  return exports;
}
const address = {
  ward: 'Phường thử', province: 'Tỉnh thử', fullAddress: 'Địa chỉ chi tiết',
  detailAddress: 'Số nhà', recipientName: 'Người nhận', recipientPhone: 'Số điện thoại',
  location: { coordinates: [106, 10] }, note: 'Ghi chú riêng',
};
const { withAssignmentArea } = load('utils/orderAddress.ts');

test('KH-41: địa chỉ dùng một lần trả khu vực và loại bỏ toàn bộ snapshot riêng tư', () => {
  const value = withAssignmentArea({ _id: 'don', addressId: null, addressSnapshot: address });
  assert.equal(JSON.stringify(value), JSON.stringify({ _id: 'don', addressId: { _id: null, ward: address.ward, province: address.province } }));
  assert.equal(value.addressSnapshot, undefined);
});

test('KH-41: snapshot được ưu tiên; địa chỉ cũ và địa chỉ bị xóa đều xử lý an toàn', () => {
  const saved = { _id: 'dia-chi', ...address, ward: 'Phường hiện tại' };
  const value = withAssignmentArea({ addressId: saved, addressSnapshot: address });
  assert.equal(value.addressId.ward, address.ward);
  assert.equal(value.addressId._id, 'dia-chi');
  assert.equal(value.addressId.fullAddress, undefined);
  assert.equal(withAssignmentArea({ addressId: saved }).addressId.ward, 'Phường hiện tại');
  assert.equal(withAssignmentArea({ addressId: null }).addressId._id, null);
  assert.equal(withAssignmentArea(null), null);
});

test('KH-41: REST và realtime cùng dùng phép biến đổi khu vực, vẫn lọc đúng thợ đang đăng nhập', async () => {
  const projections = []; const filters = [];
  const query = {
    populate(options) { projections.push(options); return this; },
    sort() { return this; },
    lean() { return Promise.resolve([]); },
  };
  const modules = {
    '../utils/orderAddress': { withAssignmentArea },
    '../models/orderAssignment.model': { OrderAssignment: {
      find: filter => { filters.push(filter); return query; }, findById: () => query,
    } },
    '../models/provider.model': { Provider: { findOne: async filter => {
      assert.equal(filter.userId, 'nguoi-dung'); assert.equal(filter.verified, true);
      return { _id: 'tho-hien-tai' };
    } } },
    '../utils/logger': { createLogger: () => ({}) },
  };
  await load('services/assignmentRealtime.service.ts', modules).getAssignmentRealtimePayload('de-nghi');
  await load('services/assignment.service.ts', modules).AssignmentService.getPendingAssignmentForProvider('nguoi-dung');
  assert.equal(filters[0].providerId, 'tho-hien-tai');
  assert.equal(filters[0].status, 'pending');
  assert.equal(projections.length, 2);
  for (const options of projections) {
    assert.match(options.select, /\baddressSnapshot\b/);
    assert.equal(options.transform, withAssignmentArea);
    const value = options.transform({ addressId: null, addressSnapshot: address });
    assert.equal(value.addressId.ward, address.ward);
    assert.equal(value.addressSnapshot, undefined);
    assert.equal(value.addressId.recipientPhone, undefined);
    assert.equal(value.addressId.location, undefined);
  }
});
