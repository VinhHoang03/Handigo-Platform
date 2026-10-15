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
let configValues = {};
let candidatesAvailable = true;
const cancelledIds = [];
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
    const expanded = Date.now() >= order.matchingSearch.expandsAt.getTime();
    assert.equal(options.maxDistanceMeters, (expanded ? order.matchingSearch.expandedRadiusKm : order.matchingSearch.initialRadiusKm) * 1000,
      'Từng vòng điều phối phải dùng bán kính đã lưu trên đơn, kể cả sau khi admin đổi cấu hình');
    matchingCalls++;
    return candidatesAvailable ? [candidate] : [];
  } } }],
  ['../services/systemConfig.service', { getNumberConfigValue: async (key, fallback) => configValues[key] ?? fallback }],
  ['../sockets/socketServer', { emitToUser: (userId, event, payload) => events.push({ userId, event, payload }) }],
  ['../services/assignmentRealtime.service', { getAssignmentRealtimePayload: async () => ({}) }],
  ['../services/notification.service', { createNotificationRecord: async () => {} }],
  ['../services/orderCancellation.service', { cancelSystemOrderWithSettlement: async (id) => {
    cancelledIds.push(id); assert.equal(candidatesAvailable, false); order.status = 'cancelled';
  } }],
  ['../services/payment.service', {}],
  ['../services/providerSchedule.service', {}],
  ['../utils/logger', { createLogger: () => ({ info() {}, warn() {}, error() {} }) }],
]) stub(path, exports);
const { DispatchService, getProviderResponseTimeoutMs, getMaxMatchingDurationSeconds } = require('../services/dispatch.service');

async function run() {
  assert.equal(await getProviderResponseTimeoutMs(), 60_000, 'Mặc định thời hạn nhận đơn là 60 giây khi admin chưa cấu hình');
  for (const scheduled of [false, true]) {
    for (const hasSearch of [false, true]) {
      const now = new Date();
      order = {
        _id: new Types.ObjectId(), status: 'created', readyForMatching: true,
        preferredProviderId: null, createdAt: now, matchingStartedAt: now,
        matchingSearch: hasSearch ? {
          initialRadiusKm: 5, expandedRadiusKm: 10,
          expandsAt: new Date(now.getTime() + 60000), expiresAt: new Date(now.getTime() + 240000),
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
      const responseDuration = assignments[0].responseDeadline.getTime() - assignments[0].assignedAt.getTime();
      assert.ok(responseDuration > 59_000 && responseDuration <= 60_000,
        'Đơn thường và lịch hẹn đều có thời hạn nhận đơn tối đa 60 giây');
      assert.equal(order.matchingSearch.expandsAt.getTime() - now.getTime(), 60_000,
        'Mặc định mở rộng bán kính sau 60 giây khi admin chưa cấu hình');
      assert.equal(order.matchingSearch.expiresAt.getTime() - order.matchingSearch.expandsAt.getTime(), 180_000,
        'Giữ nguyên thời gian tìm kiếm trong bán kính mở rộng');
      assert.ok(assignments[0].responseDeadline <= order.matchingSearch.expandsAt,
        'Đề nghị vòng đầu không còn hiệu lực sau mốc mở rộng bán kính');
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
  for (const expanded of [false, true]) {
    const now = Date.now();
    const deadline = new Date(now + 15000);
    order = {
      _id: new Types.ObjectId(), status: 'created', readyForMatching: true,
      preferredProviderId: null, createdAt: new Date(now - 45000), matchingStartedAt: new Date(now - 45000),
      matchingSearch: { initialRadiusKm: 5, expandedRadiusKm: 10,
        expandsAt: expanded ? new Date(now - 1000) : deadline,
        expiresAt: expanded ? deadline : new Date(now + 195000) },
    };
    assignments = []; events = []; matchingCalls = 0;
    await DispatchService.dispatchOrder(order._id.toString(), { serviceId: new Types.ObjectId().toString() });
    assert.equal(assignments.length, 1);
    assert.equal(assignments[0].responseDeadline.getTime(), deadline.getTime(),
      'Đề nghị gửi muộn phải hết hạn đúng mốc chuyển vòng hoặc kết thúc tìm kiếm');
  }
  for (const scheduled of [false, true]) {
    for (const [timeoutSeconds, expandMinutes] of [[45, 0.5], [45, 2], [90, 2]]) {
      configValues = { MATCHING_PROVIDER_TIMEOUT_SECONDS: timeoutSeconds, MATCHING_EXPAND_AFTER_MINUTES: expandMinutes };
      assert.equal(await getProviderResponseTimeoutMs(), timeoutSeconds * 1000,
        'Yêu cầu chọn thợ đọc thời hạn do admin thiết lập');
      assert.equal(await getMaxMatchingDurationSeconds(), expandMinutes * 60 + 180,
        'Tổng thời gian tìm kiếm dùng đúng mốc mở rộng do admin thiết lập');
      const now = new Date();
      order = {
        _id: new Types.ObjectId(), status: 'created', readyForMatching: true,
        preferredProviderId: null, createdAt: now, matchingStartedAt: now, matchingSearch: null,
      };
      assignments = []; events = []; matchingCalls = 0;
      await DispatchService.dispatchOrder(order._id.toString(), {
        serviceId: new Types.ObjectId().toString(),
        scheduledDates: scheduled ? [new Date(Date.now() + 86400000)] : [],
      });
      assert.equal(order.matchingSearch.expandsAt.getTime() - now.getTime(), expandMinutes * 60000);
      const duration = assignments[0].responseDeadline.getTime() - assignments[0].assignedAt.getTime();
      const expected = Math.min(timeoutSeconds * 1000, expandMinutes * 60000);
      assert.ok(duration > expected - 1000 && duration <= expected,
        'Đề nghị mới áp dụng cấu hình admin và không vượt mốc mở rộng');
      const storedSearch = order.matchingSearch;
      const storedDeadline = assignments[0].responseDeadline.getTime();
      configValues = { MATCHING_PROVIDER_TIMEOUT_SECONDS: 5, MATCHING_EXPAND_AFTER_MINUTES: 0.1 };
      await DispatchService.dispatchOrder(order._id.toString(), { serviceId: new Types.ObjectId().toString() });
      assert.equal(order.matchingSearch, storedSearch, 'Đổi cấu hình không thay mốc tìm kiếm đang chạy');
      assert.equal(assignments.length, 1);
      assert.equal(assignments[0].responseDeadline.getTime(), storedDeadline, 'Đề nghị đang chờ giữ nguyên thời hạn');
    }
  }
  // Cấu hình tìm 10 phút không bị giới hạn cũ 6 phút hủy trước hạn.
  for (const expiredMinutes of [0, 7]) {
    const now = Date.now();
    configValues = { MATCHING_EXPAND_AFTER_MINUTES: 5, MATCHING_EXPANDED_DURATION_MINUTES: 5 };
    const startedAt = new Date(now - expiredMinutes * 60000);
    order = { _id: new Types.ObjectId(), status: 'created', readyForMatching: true, preferredProviderId: null,
      createdAt: startedAt, matchingStartedAt: startedAt, matchingSearch: null };
    assignments = []; events = []; matchingCalls = 0;
    await DispatchService.dispatchOrder(order._id.toString(), { serviceId: new Types.ObjectId().toString() });
    assert.equal(assignments.length, 1, 'Còn hạn tìm kiếm thì tiếp tục gửi đề nghị');
    assert.equal(order.matchingSearch.expiresAt.getTime(), startedAt.getTime() + 600000);
    assignments = [];
    configValues = { INITIAL_PROVIDER_RADIUS_KM: 50, MAX_PROVIDER_RADIUS_KM: 100,
      MATCHING_EXPAND_AFTER_MINUTES: 0.1, MATCHING_EXPANDED_DURATION_MINUTES: 0.1 };
    await DispatchService.dispatchOrder(order._id.toString(), { serviceId: new Types.ObjectId().toString() });
    assert.equal(assignments.length, 1, 'Cấu hình mới không rút ngắn thời hạn của đơn đang tìm');
  }
  candidatesAvailable = false;
  const now = Date.now();
  const oldProvider = new Types.ObjectId();
  order = { _id: new Types.ObjectId(), status: 'created', inspectionRequired: true, readyForMatching: true,
    recurringGroupId: new Types.ObjectId(), createdAt: new Date(now), matchingStartedAt: new Date(now),
    reassignment: { status: 'matching', previousProviderIds: [oldProvider] },
    matchingSearch: { initialRadiusKm: 5, expandedRadiusKm: 10,
      expandsAt: new Date(now - 1000), expiresAt: new Date(now + 120000) } };
  assignments = [];
  await DispatchService.dispatchOrder(order._id.toString(), { serviceId: new Types.ObjectId().toString() }, [oldProvider]);
  assert.equal(assignments.length, 0);
  assert.equal(cancelledIds.length, 0, 'Không hủy ngay khi chưa có ứng viên nhưng vòng tìm kiếm còn hạn.');
  order.matchingSearch.expiresAt = new Date(now - 1);
  await DispatchService.dispatchOrder(order._id.toString(), { serviceId: new Types.ObjectId().toString() }, [oldProvider]);
  assert.deepEqual(cancelledIds, [order._id.toString()], 'Hết vòng tìm thợ thay thế chỉ hủy buổi hiện tại, không hủy các buổi khác trong chuỗi.');
  console.log('Đạt kiểm thử điều phối, cấu hình admin, giữ mốc đang chạy và hủy khi hết vòng tìm thợ thay thế.');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
