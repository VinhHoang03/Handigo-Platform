const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const mongoose = require('mongoose');
const { Types } = mongoose;
const { DEFAULT_BOOKING_POLICY } = require('../validations/bookingPolicy.validator');
const bookingUtils = require('../utils/bookingPolicy');
const scheduleUtils = require('../utils/providerSchedule');
const { AppError } = require('../utils/appError');

// Chạy dịch vụ nhận đơn và kiểm tra lịch thật, mô phỏng giao dịch/khóa, không kết nối database.
function load(file, modules) {
  const context = { exports: {}, require: name => modules[name] || {}, Date, Set, Map };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, context);
  return context.exports;
}
let orders = [];
let assignments = [];
let policy = DEFAULT_BOOKING_POLICY;
let active = false;
let lockCount = 0;
let claims = 0;
let notifications = 0;
let queue = Promise.resolve();
const provider = { _id: new Types.ObjectId(), userId: new Types.ObjectId(), availabilityStatus: 'online', save: async () => {} };
const at = time => new Date(`2030-01-10T${time}:00+07:00`);
const session = {
  withTransaction: callback => {
    const operation = queue.then(async () => {
      const snapshots = orders.map(order => ({ ...order }));
      active = true;
      try { return await callback(); }
      catch (error) { orders.forEach((order, index) => Object.assign(order, snapshots[index])); throw error; }
      finally { active = false; }
    });
    queue = operation.catch(() => {});
    return operation;
  },
  endSession: async () => {},
};
const Order = {
  findById: id => ({ select: async () => orders.find(order => String(order._id) === String(id)) }),
  findOne: query => ({ session: async () => orders.find(order => String(order._id) === String(query._id) && order.status === 'created' && !order.providerId) }),
  find: query => ({ session: async () => {
    assert.equal(active, true);
    if (query.recurringGroupId) return orders.filter(order => String(order.recurringGroupId) === String(query.recurringGroupId) && order.status === 'created' && !order.providerId);
    return orders.filter(order => String(order.providerId) === String(provider._id) && query.status.$in.includes(order.status)
      && !query._id.$nin.some(id => String(id) === String(order._id)));
  } }),
  updateMany: async (query, update, options) => {
    assert.equal(active, true); assert.equal(options.session, session);
    for (const order of orders) if (query._id.$in.some(id => String(id) === String(order._id))) Object.assign(order, update.$set);
  },
};
const Provider = {
  findOne: async () => provider,
  findOneAndUpdate: async (_, update, options) => {
    assert.equal(active, true); assert.equal(options.session, session);
    assert.equal(update.$inc.scheduleVersion, 1); lockCount++;
    return provider;
  },
};
const modules = {
  mongoose: { ...mongoose, startSession: async () => session },
  '../models/order.model': { Order }, '../models/provider.model': { Provider },
  '../utils/appError': { AppError }, '../utils/bookingPolicy': bookingUtils,
  '../utils/providerSchedule': scheduleUtils,
  './systemConfig.service': { getBookingPolicy: async () => policy },
  './notification.service': { createNotificationRecord: async () => { notifications++; } },
  '../utils/logger': { createLogger: () => ({ error() {} }) },
  './providerWalletEligibility.service': { assertProviderWalletEligible: async () => {} },
  '../models/address.model': { Address: { findById: () => ({ select: async () => ({ ward: 'Phường kiểm thử' }) }) } },
  '../sockets/socketServer': { emitToUser() {} },
  '../models/orderAssignment.model': { OrderAssignment: {
    findOne: async query => assignments.find(item => String(item._id) === query._id),
    find: () => ({ select: () => ({ lean: async () => [] }) }),
    findOneAndUpdate: async (query, update, options) => {
      assert.equal(active, true); assert.equal(options.session, session);
      claims++;
      const assignment = assignments.find(item => String(item._id) === String(query._id) && item.status === 'pending');
      return assignment ? Object.assign(assignment, update.$set) : null;
    },
  } },
};
modules['./providerSchedule.service'] = load('../services/providerSchedule.service', modules);
const { AssignmentService } = load('../services/assignment.service', modules);
function makeOrder(start, end, extra = {}) {
  const order = { _id: new Types.ObjectId(), serviceId: new Types.ObjectId(), addressId: new Types.ObjectId(), customerId: new Types.ObjectId(),
    orderCode: 'KIEM-THU', orderType: 'scheduled', status: 'created', paymentStatus: 'paid', paymentMethod: 'wallet',
    scheduledAt: at(start), selectedOptionsSnapshot: [], inspectionRequired: false,
    schedule: { durationMinutes: (+at(end) - +at(start)) / 60000, bufferMinutes: 0, travelMinutes: 0, expectedStartAt: at(start), expectedEndAt: at(end) }, ...extra };
  order.toObject = () => ({ ...order });
  order.save = async () => { assert.equal(active, true); return order; };
  orders.push(order);
  return order;
}
function offer(order) {
  const assignment = { _id: new Types.ObjectId(), orderId: order._id, providerId: provider._id,
    status: 'pending', assignmentType: 'appointment', responseDeadline: new Date(Date.now() + 60000) };
  assignments.push(assignment);
  return () => AssignmentService.acceptAssignment(String(assignment._id), String(provider.userId));
}
function reset() { orders = []; assignments = []; lockCount = 0; claims = 0; notifications = 0; policy = DEFAULT_BOOKING_POLICY; }

(async () => {
  reset();
  makeOrder('09:00', '12:00', { providerId: provider._id, status: 'accepted' });
  const overlap = makeOrder('11:30', '12:30');
  await assert.rejects(offer(overlap)(), error => error.statusCode === 409);
  assert.equal(claims, 0); assert.equal(overlap.status, 'created'); assert.equal(lockCount, 1);

  reset();
  makeOrder('10:00', '11:00', { providerId: provider._id, status: 'completed',
    schedule: { durationMinutes: 60, bufferMinutes: 15, travelMinutes: 30,
      expectedStartAt: new Date('2030-01-09T08:00:00+07:00'),
      expectedEndAt: new Date('2030-01-09T09:00:00+07:00') } });
  const completedOverlap = makeOrder('10:00', '11:00');
  await assert.rejects(offer(completedOverlap)(), error => error.statusCode === 409);
  assert.equal(claims, 0); assert.equal(completedOverlap.status, 'created');

  reset();
  makeOrder('09:00', '10:00', { providerId: provider._id, status: 'accepted',
    schedule: { durationMinutes: 60, bufferMinutes: 15, travelMinutes: 30, expectedStartAt: at('09:00'), expectedEndAt: at('10:00') } });
  await assert.rejects(offer(makeOrder('10:30', '11:30'))(), error => error.statusCode === 409);

  reset();
  policy = { ...DEFAULT_BOOKING_POLICY, providerCalendars: { [String(provider._id)]: { weekly: {}, absences: [] } } };
  await assert.rejects(offer(makeOrder('11:30', '12:30'))(), error => error.statusCode === 409);
  assert.equal(claims, 0);

  reset();
  const group = new Types.ObjectId();
  const first = makeOrder('09:00', '10:00', { recurringGroupId: group });
  makeOrder('14:00', '15:00', { recurringGroupId: group });
  makeOrder('13:00', '16:00', { providerId: provider._id, status: 'accepted' });
  await assert.rejects(offer(first)(), error => error.statusCode === 409);
  assert.equal(first.status, 'created'); assert.equal(claims, 0);

  reset();
  const reservedGroup = new Types.ObjectId();
  const anchor = makeOrder('09:00', '10:00', { recurringGroupId: reservedGroup });
  const later = makeOrder('14:00', '15:00', { recurringGroupId: reservedGroup });
  await offer(anchor)();
  assert.equal(anchor.bookingStatus, 'confirmed'); assert.equal(later.bookingStatus, 'reserved');
  assert.equal(later.status, 'accepted'); assert.equal(provider.availabilityStatus, 'online');
  assert.equal(lockCount, 1); assert.equal(notifications, 1);

  reset();
  const replacementGroup = new Types.ObjectId();
  const replacement = makeOrder('09:00', '10:00', { recurringGroupId: replacementGroup, reassignment: { status: 'matching' } });
  const untouched = makeOrder('09:30', '10:30', { recurringGroupId: replacementGroup });
  await offer(replacement)();
  assert.equal(replacement.reassignment.status, 'matched'); assert.equal(untouched.status, 'created');

  reset();
  const acceptFirst = offer(makeOrder('09:00', '10:00'));
  const acceptSecond = offer(makeOrder('09:30', '10:30'));
  const results = await Promise.allSettled([acceptFirst(), acceptSecond()]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(orders.filter(order => order.status === 'accepted').length, 1);
  assert.equal(lockCount, 2);
  console.log('Đã kiểm tra nhận lịch hẹn: thời lượng, dự phòng, ca làm việc, chuỗi lịch, thợ thay thế và nhận đồng thời.');
})().catch(error => { console.error(error); process.exitCode = 1; });
