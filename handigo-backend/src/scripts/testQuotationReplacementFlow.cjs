const assert = require('node:assert/strict');
const { mock } = require('node:test');
const mongoose = require('mongoose');
mongoose.set('bufferCommands', false);
const { Types } = mongoose;
const { Order } = require('../models/order.model');
const { Provider } = require('../models/provider.model');
const { OrderAssignment } = require('../models/orderAssignment.model');
const { Address } = require('../models/address.model');
const { Location } = require('../models/location.model');
const { Service } = require('../models/service.model');
const { DEFAULT_BOOKING_POLICY } = require('../validations/bookingPolicy.validator');

// Chạy các service hủy, điều phối, matching và nhận đơn thật; chỉ giả lập database, thời gian và dịch vụ ngoài.
const stub = (path, exports) => { require.cache[require.resolve(path)] = { exports }; };
const events = [];
const notifications = [];
const config = { INITIAL_PROVIDER_RADIUS_KM: 5, MAX_PROVIDER_RADIUS_KM: 10,
  MATCHING_EXPAND_AFTER_MINUTES: 1, MATCHING_EXPANDED_DURATION_MINUTES: 3,
  MATCHING_PROVIDER_TIMEOUT_SECONDS: 60, MATCHING_BATCH_SIZE: 3 };
let providers = [];
let orders = [];
let assignments = [];
let locations = [];
const session = { withTransaction: fn => fn(), endSession: async () => {} };
stub('../services/systemConfig.service', {
  getNumberConfigValue: async (key, fallback) => config[key] ?? fallback,
  getBookingPolicy: async () => DEFAULT_BOOKING_POLICY,
});
stub('../services/orderCancellation.service', {
  cancelOrderWithSettlement: () => assert.fail('Không hủy hoặc hoàn tiền khi còn tìm thợ thay thế.'),
  cancelSystemOrderWithSettlement: () => assert.fail('Không hủy khi vòng tìm kiếm còn hạn.'),
});
stub('../services/notification.service', { createNotificationRecord: async value => { notifications.push(value); } });
stub('../sockets/socketServer', { emitToUser: (userId, event, payload) => events.push({ userId, event, payload }) });
stub('../services/assignmentRealtime.service', { getAssignmentRealtimePayload: async () => ({}) });
stub('../services/providerWalletEligibility.service', {
  getEligibleProviderUserIds: async () => providers.map(provider => provider.userId),
  assertProviderWalletEligible: async () => {},
});
stub('../services/providerSchedule.service', {
  getOrderInterval: order => ({ start: (order.scheduledAt ?? new Date()).getTime(),
    end: (order.scheduledAt ?? new Date()).getTime() + 1800000, bufferMinutes: 15, travelMinutes: 30 }),
  getAvailableProviderIds: async ids => new Set(ids.map(String)),
  lockProviderSchedule: async id => providers.find(provider => String(provider._id) === String(id)),
  assertProviderSchedule: async () => {},
});
for (const name of ['wallet', 'address', 'voucher', 'servicePricing', 'reward', 'promotion', 'payment']) {
  stub(`../services/${name}.service`, {});
}
stub('../utils/logger', { createLogger: () => ({ info() {}, warn() {}, error() {}, debug() {} }) });
const { haversineMeters } = require('../services/matching.service');
const { DispatchService, getMatchingMapProviders } = require('../services/dispatch.service');
const { OrderService } = require('../services/order.service');
const { AssignmentService } = require('../services/assignment.service');

const idEquals = (a, b) => a == null ? b == null : b != null && String(a) === String(b);
const fieldValue = (row, path) => path.split('.').reduce((value, key) => value?.[key], row);
const matches = (row, filter) => Object.entries(filter).every(([key, expected]) => {
  const value = fieldValue(row, key);
  if (key === '$or') return expected.some(item => matches(row, item));
  if (expected && typeof expected === 'object' && !(expected instanceof Date) && !(expected instanceof Types.ObjectId)) {
    return Object.entries(expected).every(([operator, operand]) => {
      if (operator === '$in') return operand.some(item => idEquals(value, item));
      if (operator === '$nin') return !operand.some(item => idEquals(value, item));
      if (operator === '$eq') return idEquals(value, operand);
      if (operator === '$ne') return !idEquals(value, operand);
      if (operator === '$gte') return value >= operand;
      if (operator === '$gt') return value > operand;
      if (operator === '$lte') return value <= operand;
      if (operator === '$lt') return value < operand;
      throw new Error(`Chưa giả lập toán tử ${operator}`);
    });
  }
  if (Array.isArray(value)) return value.some(item => idEquals(item, expected));
  return idEquals(value, expected);
});
function query(read) {
  let fields;
  let lean = false;
  const result = () => {
    const project = row => {
      if (!row) return row;
      const raw = row.toObject?.() ?? row;
      return fields ? Object.fromEntries(['_id', ...fields.split(' ')].filter(key => key in raw).map(key => [key, raw[key]]))
        : lean ? raw : row;
    };
    const rows = read();
    return Array.isArray(rows) ? rows.map(project) : project(rows);
  };
  return { select(value) { fields = value; return this; }, session() { return this; },
    lean() { lean = true; return this; }, sort() { return this; },
    then(resolve, reject) { return Promise.resolve().then(result).then(resolve, reject); } };
}
function attachModel(model, rows) {
  const find = filter => rows().filter(row => matches(row, filter));
  const update = (row, changes) => {
    if (!row) return null;
    for (const [key, value] of Object.entries(changes.$set ?? {})) row.set(key, value);
    return row;
  };
  mock.method(model, 'find', filter => query(() => find(filter)));
  mock.method(model, 'findOne', filter => query(() => find(filter)[0] ?? null));
  mock.method(model, 'findById', id => query(() => rows().find(row => idEquals(row._id, id)) ?? null));
  mock.method(model, 'exists', filter => query(() => find(filter)[0] ?? null));
  mock.method(model, 'findOneAndUpdate', (filter, changes) => query(() => update(find(filter)[0], changes)));
  mock.method(model, 'updateOne', async (filter, changes) => ({ modifiedCount: Number(Boolean(update(find(filter)[0], changes))) }));
  mock.method(model, 'updateMany', async (filter, changes) => {
    const found = find(filter); found.forEach(row => update(row, changes)); return { modifiedCount: found.length };
  });
  mock.method(model.prototype, 'save', async function () { return this; });
}
function reset(orderType, distances) {
  const serviceId = new Types.ObjectId();
  providers = distances.map(distance => new Provider({ userId: new Types.ObjectId(), verified: true,
    availabilityStatus: 'online', serviceIds: [serviceId], averageRating: 5, totalCompletedOrders: 10 }));
  const address = { latitude: 10, longitude: 106, ward: 'Phường kiểm thử', province: 'Tỉnh kiểm thử' };
  locations = providers.map((provider, index) => ({ userId: provider.userId,
    coordinates: { coordinates: [106, 10 + distances[index] / 111.195] } }));
  const order = new Order({ customerId: new Types.ObjectId(), serviceId, addressId: new Types.ObjectId(),
    addressSnapshot: address, providerId: providers[0]._id, preferredProviderId: providers[0]._id,
    orderCode: 'DON-TIM-LAI', orderType, inspectionRequired: true, status: 'accepted',
    paymentMethod: 'wallet', paymentStatus: 'partially_paid', depositPaidAt: new Date(), depositAmount: 40000,
    bookingStatus: orderType === 'normal' ? 'not_required' : 'confirmed',
    scheduledAt: orderType === 'normal' ? null : new Date(Date.now() + 86400000),
    
    matchingStartedAt: new Date(Date.now() - 900000),
    matchingSearch: { initialRadiusKm: 5, expandedRadiusKm: 10,
      expandsAt: new Date(Date.now() - 840000), expiresAt: new Date(Date.now() - 660000) },
  });
  orders = [order];
  assignments = [new OrderAssignment({ orderId: order._id, providerId: providers[0]._id, status: 'accepted',
    assignedAt: new Date(Date.now() - 900000), responseDeadline: new Date(Date.now() - 840000) })];
  events.length = 0; notifications.length = 0;
  return order;
}
async function cancel(order) {
  const startedAt = Date.now();
  await OrderService.cancelOrder(order.id, providers[0].userId.toString(), 'provider', 'Không thể tiếp tục thực hiện');
  assert.equal(order.status, 'created');
  assert.equal(order.providerId, null);
  assert.equal(order.preferredProviderId, null);
  assert.equal(order.matchingStartedAt.getTime(), startedAt);
  assert.equal(order.matchingSearch.expandsAt.getTime(), startedAt + 60000);
  assert.equal(order.matchingSearch.expiresAt.getTime(), startedAt + 240000);
  assert.equal(order.depositAmount, 40000);
  assert.equal(order.paymentStatus, 'partially_paid');
}
async function accept(order, provider) {
  const assignment = assignments.find(item => idEquals(item.providerId, provider._id) && item.status === 'pending');
  assert.ok(assignment, 'Thợ mới phải nhận được đề nghị trong vòng tìm kiếm.');
  await AssignmentService.acceptAssignment(assignment.id, provider.userId.toString());
  assert.equal(order.status, 'accepted');
  assert.equal(String(order.providerId), provider.id);
  assert.equal(order.reassignment.status, 'matched');
  assert.equal(order.paymentStatus, 'partially_paid');
  assert.equal(assignments.some(item => item.status === 'pending'), false);
  assert.ok(events.some(item => item.event === 'order:updated' && item.userId === String(order.customerId)));
}
async function run() {
  mock.timers.enable({ apis: ['Date'], now: Date.now() });
  mock.method(mongoose, 'startSession', async () => session);
  attachModel(Order, () => orders);
  attachModel(Provider, () => providers);
  attachModel(OrderAssignment, () => assignments);
  mock.method(Address, 'findById', () => query(() => ({ ward: 'Phường kiểm thử', province: 'Tỉnh kiểm thử' })));
  mock.method(Service, 'findById', () => query(() => ({ serviceType: 'variable_price' })));
  mock.method(Location, 'find', filter => query(() => {
    const near = filter.coordinates.$nearSphere;
    const [longitude, latitude] = near.$geometry.coordinates;
    return locations.map(location => ({ location, distance: haversineMeters(latitude, longitude,
      location.coordinates.coordinates[1], location.coordinates.coordinates[0]) }))
      .filter(item => item.distance <= near.$maxDistance).sort((a, b) => a.distance - b.distance).map(item => item.location);
  }));
  mock.method(OrderAssignment, 'create', async data => {
    if (assignments.some(item => idEquals(item.orderId, data.orderId) && idEquals(item.providerId, data.providerId))) {
      throw Object.assign(new Error('Đề nghị nhận đơn bị trùng.'), { code: 11000 });
    }
    const assignment = new OrderAssignment(data); assignments.push(assignment); return assignment;
  });
  for (const type of ['normal', 'scheduled']) {
    const order = reset(type, [0.5, 2, 1, 7]);
    // Đề nghị cũ đã đóng không được cản trở vòng tìm lại của chính đơn đó.
    assignments.push(new OrderAssignment({ orderId: order._id, providerId: providers[2]._id, status: 'cancelled',
      assignedAt: new Date(Date.now() - 900000), responseDeadline: new Date(Date.now() - 840000) }));
    await cancel(order);
    const pending = assignments.filter(item => item.status === 'pending');
    assert.deepEqual(events.filter(item => item.event === 'assignment:new').map(item => item.userId),
      [providers[2].userId.toString(), providers[1].userId.toString()], 'Gửi theo khoảng cách: 1 km trước 2 km; loại thợ cũ và thợ ngoài 5 km.');
    assert.equal(pending.length, 2);
    const map = await getMatchingMapProviders(order.id, order.customerId.toString());
    assert.equal(map.radiusKm, 5);
    assert.deepEqual(map.providers.map(item => item.providerId), [providers[2].id, providers[1].id]);
    await accept(order, providers[2]);
  }
  const outerOrder = reset('normal', [0.5, 7]);
  await cancel(outerOrder);
  assert.equal(assignments.some(item => item.status === 'pending'), false);
  mock.timers.tick(60000);
  await DispatchService.redispatch(outerOrder.id);
  const expanded = await getMatchingMapProviders(outerOrder.id, outerOrder.customerId.toString());
  assert.equal(expanded.radiusKm, 10);
  assert.deepEqual(expanded.providers.map(item => item.providerId), [providers[1].id]);
  await accept(outerOrder, providers[1]);

  for (const response of ['timeout', 'rejected']) {
    const order = reset('normal', [0.5, 1, 7]);
    await cancel(order);
    const firstOffer = assignments.find(item => item.status === 'pending');
    if (response === 'timeout') {
      mock.timers.tick(60000);
      await DispatchService._onAssignmentTimeout(order.id, firstOffer.id, firstOffer.providerId,
        { ...order.addressSnapshot.toObject(), serviceId: order.serviceId.toString() });
    } else {
      await AssignmentService.rejectAssignment(firstOffer.id, providers[1].userId.toString(), 'Không thể nhận đơn');
      const initial = await getMatchingMapProviders(order.id, order.customerId.toString());
      assert.equal(initial.radiusKm, 5);
      assert.equal(initial.providers.length, 0);
      mock.timers.tick(60000);
      await DispatchService.redispatch(order.id);
    }
    assert.equal(firstOffer.status, response);
    const expanded = await getMatchingMapProviders(order.id, order.customerId.toString());
    assert.deepEqual(expanded.providers.map(item => item.providerId), [providers[2].id]);
    await accept(order, providers[2]);
  }
  console.log('Đạt luồng nối tiếp: thợ cũ hủy → tìm lại 5 km theo khoảng cách → mở rộng 10 km sau 60 giây → thợ mới nhận.');
  console.log('Đạt: giữ cọc, loại thợ cũ/thợ vừa từ chối hoặc hết hạn, tái sử dụng đề nghị đã đóng, bản đồ đồng bộ và lịch hẹn.');
}
run().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => { mock.restoreAll(); mock.timers.reset(); });
