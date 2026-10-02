const assert = require('node:assert/strict');
const { Types } = require('mongoose');

// Cô lập database, socket và thanh toán; không đọc cấu hình bí mật.
function stub(path, exports) {
  require.cache[require.resolve(path)] = { exports };
}

let order;
let assignments;
let events;
let matchingCalls;
const candidate = { providerId: new Types.ObjectId(), userId: new Types.ObjectId() };
stub('../models/order.model', { Order: {
  findById: () => ({ select: async (fields) => {
    // Mô phỏng projection thực: trường không được chọn sẽ không có trong kết quả.
    return Object.fromEntries(['_id', ...fields.split(' ')]
      .filter((field) => field in order).map((field) => [field, order[field]]));
  } }),
  updateOne: async (_, update) => Object.assign(order, update.$set),
} });
stub('../models/orderAssignment.model', { OrderAssignment: {
  exists: async () => assignments.length > 0,
  create: async (data) => {
    const assignment = { ...data, _id: new Types.ObjectId() };
    assignments.push(assignment);
    return assignment;
  },
} });
for (const [path, exports] of [
  ['../services/matching.service', { MatchingService: { findNearestProviders: async (options) => {
    assert.equal(options.requireOnline, true);
    matchingCalls++;
    return [candidate];
  } } }],
  ['../services/systemConfig.service', { getNumberConfigValue: async (_, fallback) => fallback }],
  ['../sockets/socketServer', { emitToUser: (userId, event, payload) => events.push({ userId, event, payload }) }],
  ['../services/assignmentRealtime.service', { getAssignmentRealtimePayload: async () => ({}) }],
  ['../services/notification.service', { createNotificationRecord: async () => {} }],
  ['../services/orderCancellation.service', { cancelSystemOrderWithSettlement: async () => assert.fail('Không được hủy đơn hợp lệ') }],
  ['../services/payment.service', {}],
  ['../services/providerSchedule.service', {}],
  ['../utils/logger', { createLogger: () => ({ info() {}, warn() {}, error() {} }) }],
]) stub(path, exports);
const { DispatchService } = require('../services/dispatch.service');

async function run() {
  for (const scheduled of [false, true]) {
    for (const hasSearch of [false, true]) {
      const now = new Date();
      order = {
        _id: new Types.ObjectId(), status: 'created', readyForMatching: true,
        preferredProviderId: null, createdAt: now, matchingStartedAt: now,
        matchingSearch: hasSearch ? {
          initialRadiusKm: 5, expandedRadiusKm: 10,
          expandsAt: new Date(Date.now() + 180000), expiresAt: new Date(Date.now() + 360000),
        } : null,
      };
      assignments = []; events = []; matchingCalls = 0;
      const ctx = { serviceId: new Types.ObjectId().toString(), province: 'Tỉnh kiểm thử', ward: 'Phường kiểm thử',
        scheduledDates: scheduled ? [new Date(Date.now() + 86400000)] : [] };
      await DispatchService.dispatchOrder(order._id.toString(), ctx);
      assert.equal(assignments.length, 1, 'Đơn tự điều phối phải tạo đề nghị nhận việc');
      assert.equal(assignments[0].assignmentType, scheduled ? 'appointment' : 'dispatch');
      assert.equal(events[0].event, 'assignment:new');
      assert.equal(events[0].userId, candidate.userId.toString());
      assert.ok(assignments[0].responseDeadline > now);
      await DispatchService.dispatchOrder(order._id.toString(), ctx);
      assert.equal(assignments.length, 1, 'Không gửi trùng đề nghị đang chờ');
      for (const patch of [{ readyForMatching: false }, { preferredProviderId: candidate.providerId }, { status: 'accepted' }]) {
        assignments = [];
        const saved = { ...order };
        Object.assign(order, patch);
        await DispatchService.dispatchOrder(order._id.toString(), ctx);
        assert.equal(assignments.length, 0, 'Không điều phối đơn chưa sẵn sàng hoặc đã chọn thợ');
        order = saved;
      }
      assert.equal(matchingCalls, 1);
    }
  }
  console.log('Đạt kiểm thử điều phối đơn thường, lịch hẹn, khởi tạo tìm kiếm, chống gửi trùng và điều kiện chặn.');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
