const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { z } = require('zod');

// Nạp module thật với database và xác thực giả, không đọc cấu hình hoặc gọi dịch vụ bên ngoài.
function load(relative, mocks = {}, globals = {}) {
  const exports = {};
  const filename = path.resolve(__dirname, '../src', relative);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, { exports, Date, Map, Set, Buffer, URL, AbortSignal, structuredClone,
    process: { env: {} }, ...globals,
    require: name => mocks[name] ?? (name.startsWith('.') ? {} : require(name)),
  }, { filename });
  return exports;
}
const { AppError } = load('utils/appError.ts');
const customerId = '111111111111111111111111';
const otherCustomerId = '222222222222222222222222';
const providerId = '333333333333333333333333';
const orderId = '444444444444444444444444';
function query(result) {
  return { select() { return this; }, populate() { return this; }, sort() { return this; },
    lean: async () => result, then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) };
}

function bookingFixture(owner = otherCustomerId, exists = true) {
  const order = { _id: orderId, customerId: owner, providerId, orderCode: 'ORD-TEST', status: 'accepted',
    bookingStatus: 'confirmed', paymentStatus: 'paid', orderType: 'normal', paymentMethod: 'bank',
    inspectionRequired: false, pricing: { totalPaidAmount: 100000 },
    providerBankAccount: 'du-lieu-rieng-cua-tho', internalAdminNote: 'ghi-chu-noi-bo' };
  const Order = { findOne: () => query(exists ? order : null) };
  let providerReads = 0;
  let detailReads = 0;
  const shared = load('services/order.service.ts', {
    '../models/order.model': { Order },
    '../models/provider.model': { Provider: { findOne: () => {
      providerReads++; return query({ _id: providerId });
    } } },
    '../models/orderStatus.model': { OrderStatus: { find: () => query([]) } },
    '../utils/appError': { AppError },
    '../utils/orderAddress': { withOrderAddress: value => value },
    '../utils/orderSettlement': { withPendingOrderSettlement: value => value },
    './orderCancellation.service': { getCustomerCancellationDeadline: async () => null },
    './orderReschedule.service': { getOrderRescheduleContext: async () => ({}) },
  }).OrderService;
  const agent = load('services/agentBooking.service.ts', {
    '../models/order.model': { Order }, '../utils/appError': { AppError },
    './order.service': { OrderService: { getOrderById: (...args) => { detailReads++; return shared.getOrderById(...args); } } },
  }).AgentBookingService;
  return { agent, providerReads: () => providerReads, detailReads: () => detailReads };
}

test('Khách hàng còn Provider Profile không được dùng agent đọc đơn được giao cho hồ sơ thợ cũ', async () => {
  const fixture = bookingFixture();
  await assert.rejects(fixture.agent.getBooking(customerId, orderId), error => error.statusCode === 403);
  assert.equal(fixture.detailReads(), 0);
  assert.equal(fixture.providerReads(), 0);
});

test('Đọc đơn của chính khách giữ dữ liệu nghiệp vụ, không trả trường riêng của admin/provider', async () => {
  const fixture = bookingFixture(customerId);
  const result = await fixture.agent.getBooking(customerId, orderId);
  assert.equal(result.orderId, orderId);
  assert.equal(result.amount, 100000);
  assert.equal(result.paymentStatus, 'paid');
  assert.doesNotMatch(JSON.stringify(result), /du-lieu-rieng-cua-tho|ghi-chu-noi-bo|customerId|providerBankAccount/);
});

test('Đơn không tồn tại vẫn trả 404', async () => {
  const fixture = bookingFixture(customerId, false);
  await assert.rejects(fixture.agent.getBooking(customerId, orderId), error => error.statusCode === 404);
});

test('API agent và AI quản trị dùng role từ database, không tin role trong JWT', async t => {
  const express = require('express');
  const users = {
    customer: { _id: customerId, role: 'CUSTOMER', email: 'customer@example.test' },
    provider: { _id: providerId, role: 'PROVIDER', providerOnboardingStatus: 'APPROVED' },
    pending: { _id: providerId, role: 'PROVIDER', providerOnboardingStatus: 'PENDING' },
    admin: { _id: otherCustomerId, role: 'ADMIN' },
  };
  let selected;
  const { authMiddleware } = load('middlewares/auth.middleware.ts', {
    jsonwebtoken: { verify: token => { selected = users[token]; if (!selected) throw new Error('Mã giả không hợp lệ');
      return { id: selected._id, role: 'ADMIN' }; } },
    '../models/user.model': { findOne: async () => ({ ...selected, status: 'active', isDeleted: false }) },
    '../services/penaltyPolicy.service': { refreshAccountLock: async () => {} },
    '../utils/token': { isTokenVersionCurrent: () => true },
    '../utils/userRole': load('utils/userRole.ts'),
    '../utils/orderActorContext': { orderActorContext: { run: (_actor, next) => next() } },
  }, { process: { env: { ACCESS_TOKEN_SECRET: 'gia-tri-gia-chi-dung-kiem-thu' } } });
  const role = load('middlewares/role.middleware.ts');
  const pass = (_req, _res, next) => next();
  const reply = (req, res) => res.json({ role: req.user.role });
  const controllers = new Proxy({}, { get: () => reply });
  const mocks = {
    '../middlewares/auth.middleware': { authMiddleware }, '../middlewares/role.middleware': role,
    '../middlewares/rateLimit.middleware': { chatbotRateLimit: pass },
    '../middlewares/validate.middleware': { validate: () => pass },
    '../middlewares/orderAttachmentUpload.middleware': { uploadOrderAttachmentImage: pass },
    './ai.controller': controllers,
  };
  const app = express();
  app.use('/ai/admin', load('ai/admin/admin-ai.routes.ts', {
    '../../middlewares/auth.middleware': { authMiddleware }, '../../middlewares/role.middleware': role,
    '../../middlewares/validate.middleware': { validate: () => pass },
    '../../middlewares/rateLimit.middleware': { createRateLimit: () => pass },
    './admin-ai.controller': controllers,
    './admin-ai.validation': { featureSchema: z.string() },
  }).default);
  app.use('/ai', load('ai/ai.routes.ts', mocks).default);
  const server = await new Promise(resolve => { const current = app.listen(0, '127.0.0.1', () => resolve(current)); });
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const cases = [
    [null, '/ai/sessions/latest', 401],
    ['customer', '/ai/sessions/latest', 200], ['customer', '/ai/admin/configs', 403],
    ['provider', '/ai/sessions/latest', 403], ['provider', '/ai/admin/configs', 403],
    ['admin', '/ai/sessions/latest', 403], ['admin', '/ai/admin/configs', 200],
    ['pending', '/ai/sessions/latest', 200], ['pending', '/ai/admin/configs', 403],
  ];
  for (const [actor, route, status] of cases) {
    const response = await fetch(base + route, { headers: actor ? { Authorization: `Bearer ${actor}` } : {} });
    assert.equal(response.status, status, `${actor}: ${route}`);
    if (status === 200) assert.equal((await response.json()).role, actor === 'admin' ? 'ADMIN' : 'CUSTOMER');
    else await response.text();
  }
});

test('Policy không thể mở rộng quyền công cụ; đổi nhóm không cấp quyền admin/provider', () => {
  const groups = load('ai/tools/tool-groups.ts');
  const { ToolRegistry } = load('ai/tools/tool-registry.ts', {
    './tool-groups': groups, '../../utils/appError': { AppError },
  });
  const registry = new ToolRegistry({ admin_private: { enabled: true, roles: ['CUSTOMER'] } }, true);
  for (const [name, role] of [['admin_private', 'ADMIN'], ['provider_private', 'PROVIDER'], ['get_my_wallet', 'CUSTOMER']]) {
    registry.register({ name, roles: [role], inputSchema: z.object({}).strict(),
      mutates: false, requiresConfirmation: false, description: name, execute: async () => ({}) });
  }
  const context = { user: { id: customerId, role: 'CUSTOMER' } };
  for (const name of ['admin_private', 'provider_private', 'read_database', 'execute_sql']) {
    assert.throws(() => registry.get(name, context), error => error.statusCode === 403);
  }
  for (const intent of [undefined, 'booking', 'order', 'payment', 'support', 'complaint']) {
    assert.ok(registry.forIntent(context, intent).every(item => !['admin_private', 'provider_private'].includes(item.name)));
  }
  const { ToolExecutor } = load('ai/tools/tool-executor.ts', { './tool-registry': { ToolRegistry } });
  const session = { id: 'session', userId: customerId, requiresReconciliation: false };
  const ctx = { ...context, sessionId: session.id };
  const tool = registry.get('get_my_wallet', ctx);
  for (const field of ['role', 'userId', 'customerId', 'providerId']) {
    assert.throws(() => new ToolExecutor(registry).authorize(session, ctx, tool, { [field]: 'ADMIN' }));
  }
});

test('Không đọc phiên, tiến độ hoặc nhận engine của cuộc trò chuyện thuộc người khác', async () => {
  const mongoose = require('mongoose');
  const data = { id: 'session', userId: customerId, state: 'WAITING_USER_INPUT', activeRequest: null };
  const document = { _id: 'session', userId: customerId, engine: 'legacy', deletedAt: null, data };
  const model = { findOne: filter => query(filter._id === document._id
    && (!filter.userId || filter.userId === customerId) ? document : null) };
  const { SessionService } = load('ai/session/session.service.ts', {
    mongoose: { ...mongoose, model: () => model }, '../../utils/appError': { AppError },
    '../../services/agentOrderProgress.service': { mergeAgentOrderMessages: async value => value },
  });
  const sessions = new SessionService();
  assert.equal((await sessions.get('session', customerId)).userId, customerId);
  for (const operation of ['get', 'progress', 'resolveEngine']) {
    await assert.rejects(sessions[operation]('session', otherCustomerId), error => error.statusCode === 404);
  }
});

test('Thông tin liên hệ và vị trí thợ chỉ có trên đơn của chính khách còn đang được thực hiện', async () => {
  let status = 'accepted';
  let profileReads = 0;
  let trackingReads = 0;
  const { AgentAssignedProviderService } = load('services/agentAssignedProvider.service.ts', {
    '../utils/appError': { AppError },
    '../models/order.model': { Order: { findOne: filter => query(filter.customerId === customerId
      ? { _id: orderId, orderCode: 'ORD-TEST', providerId, status } : null) } },
    '../models/provider.model': { Provider: { findOne: () => {
      profileReads++;
      return query({ _id: providerId, userId: { fullName: 'Nguyễn An', phone: '0912345678', email: 'private-provider-email' },
        averageRating: 4.8, totalCompletedOrders: 10, bankAccount: 'private-provider-bank', identityCard: 'private-provider-id' });
    } } },
    './orderTracking.service': { getOrderTrackingState: async (id, userId, role) => {
      assert.equal(id, orderId); assert.equal(userId, customerId); assert.equal(role, 'CUSTOMER');
      trackingReads++;
      return { provider: { latitude: 16, longitude: 108, updatedAt: new Date() } };
    } },
  });
  await assert.rejects(AgentAssignedProviderService.get(otherCustomerId, orderId), error => error.statusCode === 404);
  assert.equal(profileReads, 0); assert.equal(trackingReads, 0);
  const active = await AgentAssignedProviderService.get(customerId, orderId);
  assert.equal(active.provider.phone, '0912345678'); assert.ok(active.location);
  assert.doesNotMatch(JSON.stringify(active), /private-provider/);
  status = 'completed';
  const finished = await AgentAssignedProviderService.get(customerId, orderId);
  assert.equal(finished.provider.phone, null); assert.equal(finished.location, null);
  assert.equal(finished.canContact, false); assert.equal(finished.canTrack, false);
  assert.equal(trackingReads, 1);
});

test('Phản hồi hỗ trợ đưa nội dung dành cho khách vào AI, loại hồ sơ và thông tin riêng của quản trị viên', async () => {
  const empty = z.object({ attachments: z.array(z.unknown()).optional(), evidenceImages: z.array(z.string()).optional() });
  const ticket = { _id: orderId, orderId: null, status: 'open', createdAt: new Date(),
    subject: 'Yêu cầu hỗ trợ', description: 'Khách cần hướng dẫn đặt dịch vụ',
    assignedAdminId: { fullName: 'private-admin-name', email: 'private-admin-email' },
    internalNote: 'private-admin-note', createdViolationId: 'private-violation-id',
    responses: [{ responderRole: 'ADMIN', message: 'Phản hồi hỗ trợ dành cho khách', respondedAt: new Date(),
      responderId: { email: 'private-admin-email', phone: 'private-admin-phone' } }] };
  const { AgentCustomerCareService } = load('services/agentCustomerCare.service.ts', {
    './supportTicket.service': { getSupportTicketForUser: async (userId, ticketId) => {
      assert.equal(userId, customerId); assert.equal(ticketId, orderId); return ticket;
    } },
    '../validations/supportTicket.validator': { createSupportTicketSchema: empty, addSupportTicketResponseSchema: empty },
    '../validations/complaint.validator': { createComplaintSchema: empty },
    '../ai/agent/booking-attachments': { bookingAttachmentsSchema: z.array(z.string()) },
  });
  const result = await AgentCustomerCareService.ticket(customerId, orderId);
  assert.equal(result.responses[0].message, 'Phản hồi hỗ trợ dành cho khách');
  assert.doesNotMatch(JSON.stringify(result), /private-admin|private-violation/);
});
