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

function setup({ status, providerConnected = true, isDeleted = false }) {
  const conversation = {
    _id: new Types.ObjectId(),
    customerId: new Types.ObjectId(),
    providerId: new Types.ObjectId(),
  };
  const providerUserId = new Types.ObjectId().toString();
  const order = {
    _id: new Types.ObjectId(),
    customerId: conversation.customerId,
    providerId: providerConnected ? conversation.providerId : null,
    status,
    isDeleted,
    orderCode: 'ORD-001',
  };
  const session = { async endSession() {} };
  const messages = [];
  const matches = (filter) => order.customerId === filter.customerId &&
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
      updateMany: async () => {},
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
    service, messages, order,
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
