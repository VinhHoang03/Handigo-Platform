const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, modules) {
  const filename = path.join(__dirname, '../src', file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  const defaults = { '../utils/logger': { createLogger: () => ({ error() {} }) } };
  vm.runInNewContext(code, { exports, Date, Set, require: name => modules[name] ?? defaults[name] ?? {} }, { filename });
  return exports;
}

test('Đổi trạng thái thợ chỉ phát tín hiệu chung, không lộ vị trí cho khách khác', () => {
  const sent = [];
  const socket = load('sockets/socketServer.ts', {});
  socket.setSocketServer({ to: room => ({ emit: (event, payload) => sent.push({ room, event, payload }) }) });
  socket.emitToUser('provider-user', 'provider:availability', { availabilityStatus: 'online' });
  assert.equal(sent[0].room, 'user:provider-user');
  assert.equal(sent[1].room, 'provider-discovery');
  assert.equal(sent[1].event, 'providers:changed');
  assert.equal(Object.keys(sent[1].payload).length, 0);
});

test('GPS mới báo đúng khách của các đơn hiện đang giao cho thợ', async () => {
  const sent = [];
  const socket = load('sockets/socketServer.ts', {
    '../models/provider.model': { Provider: { findOne(filter) {
      assert.equal(filter.userId, 'provider-user');
      assert.equal(filter.verified, true);
      return { select: () => ({ lean: async () => ({ _id: 'provider' }) }) };
    } } },
    '../models/order.model': { Order: { find(filter) {
      assert.equal(filter.providerId, 'provider');
      assert.equal(filter.isDeleted, false);
      assert.equal(JSON.stringify(filter.status.$in), JSON.stringify(['accepted', 'in_progress']));
      return { select: () => ({ lean: async () => [{ _id: 'order', customerId: 'customer' }] }) };
    } } },
  });
  socket.setSocketServer({ to: room => ({ emit: (event, payload) => sent.push({ room, event, payload }) }) });
  await socket.publishProviderLocationChanged('provider-user');
  const event = sent.find(item => item.event === 'order:location');
  assert.equal(event.room, 'user:customer');
  assert.equal(event.payload.orderId, 'order');
  assert.equal(sent.some(item => item.room === 'provider-discovery'), true);
  assert.equal(sent.some(item => 'latitude' in item.payload || 'longitude' in item.payload), false);
});

for (const role of ['PROVIDER', 'CUSTOMER']) {
  test(`Lưu GPS ${role}: chỉ phát cập nhật thợ sau khi đã ghi thành công`, async () => {
    const effects = [];
    const location = load('services/location.service.ts', {
      '../models/user.model': { default: { findById: () => ({ select: () => ({ lean: async () => ({ role }) }) }) } },
      '../models/location.model': { Location: { findOneAndUpdate: () => ({ lean: async () => {
        effects.push('saved');
        return { _id: 'location' };
      } }) } },
      '../sockets/socketServer': { publishProviderLocationChanged: async () => effects.push('published') },
      './providerMovement.service': { detectProviderMovementFromLocation: async () => effects.push('detected') },
      '../utils/logger': { createLogger: () => ({ error() {} }) },
    });
    assert.equal((await location.updateCurrentLocation('user', { latitude: 10, longitude: 106 }))._id, 'location');
    assert.deepEqual(effects, role === 'PROVIDER' ? ['saved', 'published', 'detected'] : ['saved']);
  });
}
