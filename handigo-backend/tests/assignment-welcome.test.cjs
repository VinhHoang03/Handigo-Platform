const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { Types } = require('mongoose');

function load(file, modules) {
  const filename = path.join(__dirname, '../src/services', file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Date, Intl, Map, Set, require: name => modules[name] ?? {} }, { filename });
  return exports;
}
function setup() {
  const session = {}, messages = new Map(), calls = [], events = [];
  const conversation = { _id: new Types.ObjectId(), providerId: new Types.ObjectId(),
    async save(options) { assert.equal(options.session, session); calls.push('save-conversation'); } };
  const chain = value => ({ select() { return this; }, session(actual) { assert.equal(actual, session); return Promise.resolve(value); }, populate: async () => value });
  const service = load('chat.service.ts', {
    mongoose: { Types },
    '../models/message.model': { Message: {
      findById: id => chain(messages.get(id.toString())),
      create: async (values, options) => {
        assert.equal(options.session, session);
        calls.push('create-message');
        const message = { ...values[0], createdAt: new Date() };
        messages.set(message._id.toString(), message);
        return [message];
      },
    } },
    '../models/conversation.model': { Conversation: {
      findOne: () => chain(conversation),
      findOneAndUpdate: async (filter, update, options) => {
        assert.equal(options.session, session);
        assert.equal(options.upsert, true);
        assert.equal(options.runValidators, true);
        Object.assign(conversation, update.$set);
        return conversation;
      },
    } },
    '../models/user.model': { __esModule: true, default: { findById: () => chain({ fullName: 'Nguyễn Văn An' }) } },
    '../sockets/socketServer': { emitToConversation: (...args) => events.push(args) },
  });
  const order = { _id: new Types.ObjectId(), customerId: new Types.ObjectId(), orderCode: 'ORD-001', createdAt: new Date('2026-10-24T17:05:00Z') };
  return { service, session, messages, calls, events, conversation, order, provider: new Types.ObjectId(), user: new Types.ObjectId().toString(), assignment: new Types.ObjectId() };
}

test('Lời chào ghi đúng tên thợ, mã đơn và giờ Việt Nam cho đơn đặt ngay', () => {
  const { service, order } = setup();
  const text = service.buildAssignmentWelcomeContent('Nguyễn Văn An', order);
  assert.match(text, /tôi là Nguyễn Văn An/);
  assert.match(text, /ORD-001/);
  assert.match(text, /00:05 ngày 25\/10\/2026/);
  assert.match(text, /sẽ sớm đến/);
  assert.doesNotMatch(text, /undefined|Invalid Date|đúng lịch hẹn/);
});

test('Đơn hẹn lịch có giờ hẹn, không dùng giờ tạo đơn làm giờ đến', () => {
  const { service, order } = setup();
  const text = service.buildAssignmentWelcomeContent('An', { ...order, scheduledAt: new Date('2026-10-26T02:30:00Z') });
  assert.match(text, /đúng lịch hẹn lúc 09:30 ngày 26\/10\/2026/);
  assert.match(text, /được đặt lúc 00:05 ngày 25\/10\/2026/);
});

test('Tạo hội thoại và lời chào cùng session; gửi từ tài khoản thợ', async () => {
  const ctx = setup();
  await ctx.service.createAssignmentWelcome(ctx.order, ctx.provider, ctx.user, ctx.assignment, ctx.session);
  const message = ctx.messages.get(ctx.assignment.toString());
  assert.equal(message.senderRole, 'provider');
  assert.equal(message.senderId, ctx.user);
  assert.equal(message.messageType, 'text');
  assert.equal(message.conversationId, ctx.conversation._id);
  assert.equal(ctx.conversation.customerId, ctx.order.customerId);
  assert.equal(ctx.conversation.providerId, ctx.provider);
  assert.equal(ctx.conversation.providerLastSeenAt, null);
  assert.equal(ctx.conversation.lastMessage.content, message.content);
  assert.equal(ctx.events.length, 0);
  await ctx.service.publishAssignmentWelcome(ctx.assignment);
  assert.equal(ctx.events.length, 1);
  assert.equal(ctx.events[0][1], 'message:new');
});

test('Gọi lại cùng assignment không tạo lời chào trùng hay ghi đè tin nhắn mới', async () => {
  const ctx = setup();
  await ctx.service.createAssignmentWelcome(ctx.order, ctx.provider, ctx.user, ctx.assignment, ctx.session);
  ctx.conversation.lastMessage = { content: 'Tin nhắn mới hơn' };
  await ctx.service.createAssignmentWelcome(ctx.order, ctx.provider, ctx.user, ctx.assignment, ctx.session);
  assert.equal(ctx.messages.size, 1);
  assert.equal(ctx.calls.filter(value => value === 'create-message').length, 1);
  assert.equal(ctx.conversation.lastMessage.content, 'Tin nhắn mới hơn');
});

function acceptance(failCommit = false) {
  const events = [];
  const provider = { _id: new Types.ObjectId(), userId: new Types.ObjectId(), availabilityStatus: 'online', save: async () => {} };
  const order = { _id: new Types.ObjectId(), addressId: new Types.ObjectId(), customerId: new Types.ObjectId(), serviceId: new Types.ObjectId(), orderCode: 'ORD-1', status: 'created', providerId: null, paymentStatus: 'paid', schedule: { durationMinutes: 60, travelMinutes: 20 }, save: async () => events.push('save-order') };
  const assignment = { _id: new Types.ObjectId(), orderId: order._id, providerId: provider._id, status: 'pending', responseDeadline: new Date(Date.now() + 60000) };
  const session = { async withTransaction(run) { const result = await run(); if (failCommit) throw new Error('Không commit được'); events.push('commit'); return result; }, async endSession() {} };
  const query = value => ({ select() { return this; }, lean: async () => value, session: async actual => { assert.equal(actual, session); return value; }, then: (yes, no) => Promise.resolve(value).then(yes, no) });
  const service = load('assignment.service.ts', {
    mongoose: { __esModule: true, default: { startSession: async () => session }, Types },
    '../models/order.model': { Order: { findById: () => query(order), findOne: () => query(order) } },
    '../models/orderAssignment.model': { OrderAssignment: { findOne: async () => assignment, find: () => query([]), findOneAndUpdate: async () => { assignment.status = 'accepted'; return assignment; } } },
    '../models/provider.model': { Provider: { findOne: async () => provider } },
    '../models/address.model': { Address: { findById: () => query({}) } },
    '../services/providerWalletEligibility.service': {},
    './providerWalletEligibility.service': { assertProviderWalletEligible: async () => {} },
    './systemConfig.service': { getBookingPolicy: async () => ({ travelMinutes: 20, bufferMinutes: 15 }) },
    './providerSchedule.service': { lockProviderSchedule: async () => provider, assertProviderSchedule: async () => {} },
    './chat.service': {
      createAssignmentWelcome: async (...args) => { assert.equal(args[4], session); events.push('stage-welcome'); },
      publishAssignmentWelcome: async () => events.push('publish-welcome'),
    },
    '../utils/logger': { createLogger: () => ({ error() {} }) },
    '../sockets/socketServer': { emitToUser: () => events.push('emit') },
    './notification.service': { createNotificationRecord: async () => {} },
    '../utils/appError': { AppError: class extends Error {} },
  }).AssignmentService;
  return { service, events, assignment, provider };
}

test('Nhận đơn lưu lời chào trong transaction, chỉ phát sau commit', async () => {
  const ctx = acceptance();
  await ctx.service.acceptAssignment(ctx.assignment._id.toString(), ctx.provider.userId.toString());
  assert.ok(ctx.events.indexOf('stage-welcome') < ctx.events.indexOf('commit'));
  assert.ok(ctx.events.indexOf('publish-welcome') > ctx.events.indexOf('commit'));
  await assert.rejects(() => ctx.service.acceptAssignment(ctx.assignment._id.toString(), ctx.provider.userId.toString()));
  assert.equal(ctx.events.filter(value => value === 'stage-welcome').length, 1);
});

test('Giao dịch nhận đơn thất bại không phát lời chào hay thông báo đơn đã nhận', async () => {
  const ctx = acceptance(true);
  await assert.rejects(() => ctx.service.acceptAssignment(ctx.assignment._id.toString(), ctx.provider.userId.toString()), /Không commit được/);
  assert.equal(ctx.events.includes('publish-welcome'), false);
  assert.equal(ctx.events.includes('emit'), false);
});