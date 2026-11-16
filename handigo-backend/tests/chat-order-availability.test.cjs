const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { Types } = require('mongoose');

const filename = path.join(__dirname, '../src/services/chat.service.ts');
const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    esModuleInterop: true,
  },
}).outputText;

function setup({ status, providerConnected = true, isDeleted = false, sameOrder = true, scope = 'order' }) {
  const conversation = {
    _id: new Types.ObjectId(),
    customerId: new Types.ObjectId(),
    providerId: new Types.ObjectId(),
    orderId: new Types.ObjectId(),
    scope,
  };
  const providerUserId = new Types.ObjectId().toString();
  const order = {
    _id: sameOrder ? conversation.orderId : new Types.ObjectId(),
    customerId: conversation.customerId,
    providerId: providerConnected ? conversation.providerId : null,
    status,
    isDeleted,
    orderCode: 'ORD-001',
  };
  const session = { async endSession() {} };
  const messages = [];
  const matches = (filter) => order._id === filter._id && order.customerId === filter.customerId &&
    order.providerId === filter.providerId &&
    filter.status.$in.includes(order.status) && order.isDeleted === filter.isDeleted;
  const query = (value) => ({
    sort() { return this; },
    select() { return this; },
    lean: async () => value,
    populate: async () => value,
    session: async () => value,
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  });
  class AppError extends Error {
    constructor(message, statusCode, code) {
      super(message);
      Object.assign(this, { statusCode, code });
    }
  }
  const modules = {
    mongoose: { Types, startSession: async () => session },
    '../utils/appError': { AppError },
    '../utils/transaction': { withTransactionRetry: (actual, work) => work(actual) },
    '../models/conversation.model': { Conversation: {
      findOne: async () => conversation,
      findOneAndUpdate: async () => ({ ...conversation, save: async () => {} }),
    } },
    '../models/provider.model': { Provider: {
      findOne: async ({ userId }) => userId === providerUserId ? { _id: conversation.providerId } : null,
    } },
    '../models/order.model': { Order: {
      exists: async (filter) => matches(filter) ? order : null,
      findOne: (filter) => query(matches(filter) ? order : null),
      findOneAndUpdate: (filter, _update, options) => {
        assert.equal(options.session, session);
        return query(matches(filter) ? order : null);
      },
      updateMany: async filter => { assert.equal(filter._id, conversation.orderId); },
    } },
    '../models/message.model': { Message: {
      create: async ([payload]) => {
        const message = { _id: new Types.ObjectId(), createdAt: new Date(), ...payload };
        messages.push(message);
        return [message];
      },
      findOne: () => query(messages.at(-1)),
      findById: () => query(messages.at(-1)),
    } },
    './penaltyPolicy.service': { assertFeatureAllowed: async () => {} },
  };
  const service = {};
  vm.runInNewContext(code, { exports: service, require: (name) => modules[name] ?? {} }, { filename });
  return {
    service, messages, order, conversation,
    customer: [conversation.customerId.toString(), 'CUSTOMER', conversation._id.toString()],
    provider: [providerUserId, 'PROVIDER', conversation._id.toString()],
  };
}

test('Đơn đã nhận hoặc đang làm cho phép khách và thợ gửi văn bản và ảnh', async () => {
  for (const status of ['accepted', 'in_progress']) {
    const { service, customer, provider, messages } = setup({ status });
    const { activeOrder } = await service.getConversationAvailability(...customer);
    assert.equal(activeOrder.orderCode, 'ORD-001');
    await service.authorizeChatImageUpload(...provider);
    await service.sendMessage(...customer, { content: 'Hẹn gặp anh.' });
    await service.sendMessage(...provider, { messageType: 'image', imageUrl: 'https://example.test/anh.png' });
    assert.equal(messages.length, 2);
  }
});

test('Đơn kết thúc, chưa được nhận, thiếu thợ hoặc đã xóa khóa gửi văn bản và ảnh', async () => {
  for (const state of [
    { status: 'completed' },
    { status: 'cancelled' },
    { status: 'created' },
    { status: 'accepted', providerConnected: false },
    { status: 'in_progress', isDeleted: true },
  ]) {
    const { service, customer, provider, messages } = setup(state);
    const inactive = { code: 'CHAT_ORDER_INACTIVE', statusCode: 400 };
    assert.equal((await service.getConversationAvailability(...customer)).activeOrder, null);
    await assert.rejects(service.authorizeChatImageUpload(...provider), inactive);
    await assert.rejects(service.sendMessage(...customer, { content: 'Xin chào.' }), inactive);
    await assert.rejects(service.sendMessage(...provider, { messageType: 'image', imageUrl: 'https://example.test/anh.png' }), inactive);
    assert.equal(messages.length, 0);
  }
});

test('Quyền gửi đã xác nhận vẫn bị chặn khi đơn kết thúc trước giao dịch ghi', async () => {
  const { service, customer, order, messages } = setup({ status: 'in_progress' });
  assert.ok((await service.getConversationAvailability(...customer)).activeOrder);
  order.status = 'completed';
  await assert.rejects(service.sendMessage(...customer, { content: 'Xin chào.' }), { code: 'CHAT_ORDER_INACTIVE' });
  assert.equal(messages.length, 0);
});

test('Người ngoài cuộc trò chuyện không được kiểm tra quyền gửi hay tải ảnh', async () => {
  const { service, customer } = setup({ status: 'accepted' });
  const outsider = [new Types.ObjectId().toString(), 'CUSTOMER', customer[2]];
  await assert.rejects(service.getConversationAvailability(...outsider), { statusCode: 403 });
  await assert.rejects(service.authorizeChatImageUpload(...outsider), { statusCode: 403 });
});

test('Đơn khác cùng khách và thợ không mở quyền gửi cho cuộc trò chuyện này', async () => {
  const { service, customer, provider, messages } = setup({ status: 'accepted', sameOrder: false });
  assert.equal((await service.getConversationAvailability(...customer)).activeOrder, null);
  await assert.rejects(service.sendMessage(...customer, { content: 'Tin của đơn cũ.' }), { code: 'CHAT_ORDER_INACTIVE' });
  await assert.rejects(service.authorizeChatImageUpload(...provider), { code: 'CHAT_ORDER_INACTIVE' });
  assert.equal(messages.length, 0);
});

test('Thợ cũ không gửi thêm vào chat sau khi đơn đã chuyển sang thợ khác', async () => {
  const ctx = setup({ status: 'accepted' });
  ctx.order.providerId = new Types.ObjectId();
  assert.equal((await ctx.service.getConversationAvailability(...ctx.provider)).activeOrder, null);
  await assert.rejects(ctx.service.sendMessage(...ctx.provider, { content: 'Tin của thợ cũ.' }), { code: 'CHAT_ORDER_INACTIVE' });
  assert.equal(ctx.messages.length, 0);
});

for (const scope of ['legacy', undefined]) {
  test(`Lịch sử cũ chỉ xem lại dù còn đơn hoạt động: ${scope}`, async () => {
    const ctx = setup({ status: 'accepted', scope: scope ?? 'legacy' });
    if (scope === undefined) delete ctx.conversation.scope;
    assert.equal((await ctx.service.getConversationAvailability(...ctx.customer)).activeOrder, null);
    await assert.rejects(ctx.service.sendMessage(...ctx.customer, { content: 'Không gửi vào lịch sử cũ.' }), { code: 'CHAT_ORDER_INACTIVE' });
    assert.equal(ctx.messages.length, 0);
  });
}

test('Hai đơn cùng khách–thợ có chat riêng; mở lại cùng đơn không tạo trùng và không dùng chat cũ', async () => {
  const customerId = new Types.ObjectId(), providerId = new Types.ObjectId();
  const orders = [1, 2].map(number => ({
    _id: new Types.ObjectId(), customerId, providerId, status: 'accepted', isDeleted: false, orderCode: `ORD-${number}`,
  }));
  const legacy = { _id: new Types.ObjectId(), orderId: orders[0]._id, customerId, providerId, isDeleted: false };
  const conversations = [legacy];
  const session = { async endSession() {} };
  const query = value => ({
    select() { return this; }, sort() { return this; }, session() { return this; }, populate() { return this; },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  });
  const modules = {
    mongoose: { Types, startSession: async () => session },
    '../utils/appError': { AppError: Error },
    '../utils/transaction': { withTransactionRetry: (actual, work) => work(actual) },
    '../models/order.model': { Order: {
      findOne: filter => query(orders.find(order => String(order._id) === String(filter._id))),
    } },
    '../models/provider.model': { Provider: { updateOne: async () => ({ matchedCount: 1 }) } },
    '../models/conversation.model': { Conversation: {
      findOne: filter => query(conversations.find(item => Object.entries(filter).every(([key, value]) => String(item[key]) === String(value)))),
      create: async ([value]) => {
        const document = { _id: new Types.ObjectId(), ...value };
        conversations.push(document);
        return [document];
      },
      findById: id => query(conversations.find(item => String(item._id) === String(id))),
    } },
  };
  const service = {};
  vm.runInNewContext(code, { exports: service, require: name => modules[name] ?? {} }, { filename });
  const open = order => service.getOrCreateConversationByOrder(String(customerId), 'CUSTOMER', String(order._id));
  const first = await open(orders[0]);
  const second = await open(orders[1]);
  assert.notEqual(String(first._id), String(second._id));
  assert.notEqual(String(first._id), String(legacy._id));
  assert.equal(first.orderId, orders[0]._id);
  assert.equal(second.orderId, orders[1]._id);
  assert.equal(first.scope, 'order');
  assert.equal((await open(orders[0]))._id, first._id);
  assert.equal(conversations.length, 3);
  orders[0].providerId = new Types.ObjectId();
  const reassigned = await open(orders[0]);
  assert.notEqual(String(reassigned._id), String(first._id));
  assert.equal(first.providerId, providerId);
  assert.equal(reassigned.providerId, orders[0].providerId);
});
