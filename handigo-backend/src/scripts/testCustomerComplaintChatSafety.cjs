const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const mongoose = require('mongoose');
const { Complaint } = require('../models/complaint.model');
const { Conversation } = require('../models/conversation.model');
const { Message } = require('../models/message.model');
const { AppError } = require('../utils/appError');
const { withTransactionRetry } = require('../utils/transaction');

// Dùng document và delta Mongoose thật; transaction/database được cô lập.
const customer = new mongoose.Types.ObjectId();
const providerUser = new mongoose.Types.ObjectId();
const admin = new mongoose.Types.ObjectId();
const orderId = new mongoose.Types.ObjectId();
const providerId = new mongoose.Types.ObjectId();
let state, version, hold, reached, pauseKind, failEvidence, failPreview;
const copy = value => {
  if (value instanceof Date) return new Date(value);
  if (value instanceof mongoose.Types.ObjectId) return new mongoose.Types.ObjectId(value);
  if (Array.isArray(value)) return value.map(copy);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item !== 'function').map(([key, item]) => [key, copy(item)]));
  return value;
};
const get = (row, key) => key.split('.').reduce((value, part) => value?.[part], row);
function set(row, key, value) {
  const parts = key.split('.');
  const last = parts.pop();
  let target = row;
  for (const part of parts) target = target[part] ??= {};
  target[last] = copy(value);
}
const matches = (row, filter) => Object.entries(filter).every(([key, value]) => {
  const actual = get(row, key);
  if (value && '$ne' in Object(value)) return String(actual) !== String(value.$ne);
  return value == null ? actual == null : String(actual) === String(value);
});
function apply(row, update) {
  for (const [key, value] of Object.entries(update.$set ?? {})) set(row, key, value);
  for (const [key, value] of Object.entries(update.$inc ?? {})) set(row, key, (get(row, key) ?? 0) + value);
  for (const [key, value] of Object.entries(update)) if (!key.startsWith('$')) set(row, key, value);
}
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
async function pause(kind) {
  if (pauseKind !== kind) return;
  pauseKind = null; reached.resolve(); await hold.promise;
}
const view = session => session?.snapshot ?? state;
const connection = { startSession: async () => ({
  async withTransaction(work) {
    const previous = version;
    this.snapshot = copy(state);
    const result = await work(this);
    if (previous !== version) throw Object.assign(new Error('Xung đột giao dịch giả lập'), { code: 112 });
    state = this.snapshot; version++;
    return result;
  },
  async endSession() {},
}) };
const constructors = { complaints: Complaint, conversations: Conversation, messages: Message };
function document(row, collection, session) {
  if (!row) return null;
  if (!constructors[collection]) return copy(row);
  const doc = constructors[collection].hydrate(copy(row));
  doc.save = async (options = {}) => {
    const activeSession = options.session ?? session;
    assert.ok(activeSession, 'Mọi lần ghi phải thuộc giao dịch.');
    if (collection === 'conversations') {
      if (failPreview) throw new Error('Lỗi lưu bản xem trước giả lập');
      await pause('preview');
    }
    const [filter, update] = doc.$__delta();
    const target = view(activeSession)[collection].find(item => matches(item, filter));
    assert.ok(target); apply(target, update);
    return doc;
  };
  return doc;
}
function query(work) {
  return { session(session) { this.context = session; return this; }, select() { return this; }, populate() { return this; }, lean() { return this; },
    sort(order) { this.order = order; return this; },
    then(resolve, reject) { return Promise.resolve().then(() => work(this.context, this.order)).then(resolve, reject); } };
}
function model(collection) {
  return {
    findOne: filter => query((session, order) => {
      let rows = view(session)[collection].filter(row => matches(row, filter));
      if (order) rows = rows.sort((left, right) => Number(right.createdAt) - Number(left.createdAt) || String(right._id).localeCompare(String(left._id)));
      return document(rows[0], collection, session);
    }),
    findById: id => query(session => document(view(session)[collection].find(row => String(row._id) === String(id)), collection, session)),
    find: filter => query(session => view(session)[collection].filter(row => matches(row, filter)).map(row => document(row, collection, session))),
    findOneAndUpdate: (filter, update, options) => query(() => {
      assert.ok(options.session); assert.equal(options.runValidators, true);
      const row = view(options.session)[collection].find(item => matches(item, filter));
      if (!row) return null;
      apply(row, update); return document(row, collection, options.session);
    }),
    updateOne: async (filter, update, options) => {
      assert.ok(options.session); assert.equal(options.runValidators, true);
      const row = view(options.session)[collection].find(item => matches(item, filter));
      if (!row) return { matchedCount: 0 };
      apply(row, update); return { matchedCount: 1 };
    },
    create: async (rows, { session }) => {
      assert.ok(session);
      if (collection === 'complaints') await pause('create');
      return rows.map(row => {
        const value = new constructors[collection]({ ...row, createdAt: new Date(), updatedAt: new Date() }).toObject();
        view(session)[collection].push(value); return document(value, collection, session);
      });
    },
    insertMany: async (rows, { session }) => {
      assert.ok(session); await pause('evidence');
      view(session)[collection].push(...copy(rows));
      if (failEvidence) throw new Error('Lỗi lưu bằng chứng giả lập');
    },
  };
}
function load(file, modules) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { exports, Date, require: name => name in modules ? modules[name] : require(name) });
  return exports;
}
const modules = {
  mongoose: { __esModule: true, default: connection, Types: mongoose.Types },
  '../utils/transaction': { withTransactionRetry }, '../utils/appError': { AppError },
  '../models/complaint.model': { Complaint: model('complaints') },
  '../models/complaintEvidence.model': { ComplaintEvidence: model('evidence') },
  '../models/conversation.model': { Conversation: model('conversations') },
  '../models/message.model': { Message: model('messages') },
  '../models/order.model': { Order: model('orders') },
  '../models/provider.model': { Provider: { findOne: () => query(() => ({ _id: providerId, userId: providerUser })) } },
  '../models/orderStatus.model': { OrderStatus: { findOne: () => query(() => ({ createdAt: new Date() })) } },
  '../models/report.model': {},
  '../models/user.model': {},
  '../sockets/socketServer': { emitToConversation: () => {} },
  './penaltyPolicy.service': { assertFeatureAllowed: async () => {} },
};
const complaints = load('../services/complaint.service', modules);
const chat = load('../services/chat.service', modules);
function reset() {
  version = 0; hold = deferred(); reached = deferred(); pauseKind = null; failEvidence = false; failPreview = false;
  state = { orders: [{ _id: orderId, customerId: customer, providerId, status: 'completed', isDeleted: false, updatedAt: new Date() }],
    complaints: [], evidence: [], conversations: [new Conversation({ orderId, customerId: customer, providerId, __v: 0 }).toObject()], messages: [] };
}
const payload = { orderId: String(orderId), title: 'Khiếu nại đơn hàng', description: 'Nội dung cần được xử lý' };
async function complaintCases() {
  reset(); pauseKind = 'create';
  const first = complaints.createComplaint(String(customer), 'CUSTOMER', payload);
  await reached.promise;
  await complaints.createComplaint(String(customer), 'CUSTOMER', payload);
  hold.resolve(); await assert.rejects(first, /đã tạo khiếu nại/);
  assert.equal(state.complaints.length, 1);
  await complaints.createComplaint(String(providerUser), 'PROVIDER', payload);
  assert.equal(state.complaints.length, 2, 'Khách và thợ vẫn có hồ sơ riêng.');
  for (const target of ['resolved', 'rejected', 'cancelled']) {
    reset();
    state.complaints.push(new Complaint({ ...payload, orderId, complainantId: customer, targetUserId: providerUser,
      status: 'evidence_requested', __v: 0 }).toObject());
    const id = String(state.complaints[0]._id);
    pauseKind = 'evidence';
    const adding = complaints.addComplaintEvidence(String(customer), 'CUSTOMER', id,
      { files: [{ fileType: 'image', url: 'https://example.test/bang-chung.jpg' }] });
    await reached.promise;
    if (target === 'cancelled') await complaints.cancelComplaint(String(customer), id);
    else await complaints.updateComplaintStatus(String(admin), id, { status: target });
    hold.resolve(); await assert.rejects(adding, /đã kết thúc/);
    assert.equal(state.complaints[0].status, target); assert.equal(state.evidence.length, 0);
    assert.ok(state.complaints[0].resolvedAt);
  }
  reset();
  const created = await complaints.createComplaint(String(customer), 'CUSTOMER', payload);
  const id = String(created._id);
  await complaints.requestEvidence(String(admin), id, 'Vui lòng bổ sung hình ảnh');
  await complaints.addComplaintEvidence(String(customer), 'CUSTOMER', id,
    { files: [{ fileType: 'image', url: 'https://example.test/anh.jpg' }] });
  assert.equal(state.complaints[0].status, 'under_review'); assert.equal(state.evidence.length, 1);
  failEvidence = true;
  await assert.rejects(complaints.addComplaintEvidence(String(customer), 'CUSTOMER', id,
    { files: [{ fileType: 'image', url: 'https://example.test/anh-loi.jpg' }] }), /Lỗi lưu bằng chứng/);
  assert.equal(state.evidence.length, 1);
  await assert.rejects(complaints.cancelComplaint(String(admin), id), /Không tìm thấy/);
  console.log('Đạt KH-23, KH-24: khóa trạng thái, hoàn tác bằng chứng, chống trùng và ownership.');
}
async function chatCases() {
  reset(); pauseKind = 'preview';
  const id = String(state.conversations[0]._id);
  const first = chat.sendMessage(String(customer), 'CUSTOMER', id, { content: 'Tin thứ nhất' });
  await reached.promise;
  const second = await chat.sendMessage(String(customer), 'CUSTOMER', id, { content: 'Tin thứ hai' });
  hold.resolve(); await first;
  assert.equal(state.messages.length, 2);
  const ordered = [...state.messages].sort((left, right) => Number(right.createdAt) - Number(left.createdAt) || String(right._id).localeCompare(String(left._id)));
  assert.equal(String(state.conversations[0].lastMessage.messageId), String(ordered[0]._id));
  await chat.updateMessage(String(customer), 'CUSTOMER', String(second._id), 'Tin đã sửa');
  assert.notEqual(String(state.conversations[0].lastMessage.messageId), String(second._id));
  const lastId = String(state.conversations[0].lastMessage.messageId);
  await chat.deleteMessage(String(customer), 'CUSTOMER', lastId);
  assert.equal(String(state.conversations[0].lastMessage.messageId), String(second._id));
  assert.equal(state.conversations[0].lastMessage.content, 'Tin đã sửa');
  failPreview = true;
  await assert.rejects(chat.sendMessage(String(customer), 'CUSTOMER', id, { content: 'Tin bị hoàn tác' }), /Lỗi lưu bản xem trước/);
  assert.equal(state.messages.length, 2);
  for (const operation of ['update', 'delete']) {
    reset();
    const conversationId = String(state.conversations[0]._id);
    const original = await chat.sendMessage(String(customer), 'CUSTOMER', conversationId, { content: 'Tin đang thao tác' });
    pauseKind = 'preview';
    const sending = chat.sendMessage(String(customer), 'CUSTOMER', conversationId, { content: 'Tin mới đồng thời' });
    await reached.promise;
    if (operation === 'update') await chat.updateMessage(String(customer), 'CUSTOMER', String(original._id), 'Nội dung sửa đồng thời');
    else await chat.deleteMessage(String(customer), 'CUSTOMER', String(original._id));
    hold.resolve(); await sending;
    const latest = [...state.messages].filter(row => !row.isDeleted)
      .sort((left, right) => Number(right.createdAt) - Number(left.createdAt) || String(right._id).localeCompare(String(left._id)))[0];
    assert.equal(String(state.conversations[0].lastMessage.messageId), String(latest._id));
    assert.equal(state.conversations[0].lastMessage.content, latest.content);
  }
  console.log('Đạt KH-26: gửi đồng thời, sửa/xóa tin cuối và hoàn tác khi lỗi.');
}
(async () => { await complaintCases(); await chatCases(); })().catch(error => { console.error(error); process.exitCode = 1; });
