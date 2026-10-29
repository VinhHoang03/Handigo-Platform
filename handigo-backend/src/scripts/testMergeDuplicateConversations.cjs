const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const mongoose = require('mongoose');
const { EJSON } = mongoose.mongo.BSON;
const id = () => new mongoose.Types.ObjectId();
const copy = value => EJSON.parse(EJSON.stringify(value, { relaxed: false }));
const customer = id(), provider = id(), user = id(), unrelated = id();
const oldest = id(), newer = id(), otherChat = id(), oldOrder = id(), newOrder = id();
const date = number => new Date(1700000000000 + number);
const initial = () => ({
  conversations: [
    { _id: oldest, customerId: customer, providerId: provider, orderId: oldOrder, isDeleted: false, createdAt: date(0), __v: 0,
      customerLastSeenAt: date(5), providerLastSeenAt: null },
    { _id: newer, customerId: customer, providerId: provider, orderId: newOrder, isDeleted: false, createdAt: date(1), __v: 0,
      customerLastSeenAt: date(10), providerLastSeenAt: date(10) },
    { _id: otherChat, customerId: unrelated, providerId: provider, orderId: id(), isDeleted: false, createdAt: date(2) },
  ],
  messages: [
    { _id: id(), conversationId: oldest, senderId: customer, senderRole: 'customer', messageType: 'text', content: 'Xin chào', createdAt: date(1), isDeleted: false },
    { _id: id(), conversationId: newer, senderId: user, senderRole: 'provider', messageType: 'text', content: 'Xin chào', createdAt: date(2), isDeleted: false },
    { _id: id(), conversationId: newer, senderId: customer, senderRole: 'customer', messageType: 'text', content: 'Tin đã xóa', createdAt: date(3), isDeleted: true },
  ],
  reports: [{ _id: id(), conversationId: newer, orderId: newOrder }],
  providers: [{ _id: provider, userId: user, isDeleted: false, __v: 0 }],
  orders: [{ _id: newOrder, customerId: customer, providerId: provider, createdAt: date(2), isDeleted: false }],
});
const matches = (row, filter) => Object.entries(filter).every(([key, expected]) =>
  expected?.$in ? expected.$in.some(value => String(value) === String(row[key])) : String(expected) === String(row[key]));

async function execute(state, apply, fail = false) {
  const backups = [], logs = [];
  const query = work => ({ session(session) { this.context = session; return this; }, lean() { return this; }, select() { return this; },
    sort(order) { this.order = order; return this; },
    then(resolve, reject) { return Promise.resolve().then(() => work(this.context, this.order)).then(resolve, reject); } });
  const view = session => session?.snapshot ?? state;
  const sort = (rows, order) => rows.sort((left, right) => {
    for (const [key, direction] of Object.entries(order ?? {})) {
      const result = left[key] instanceof Date ? left[key] - right[key] : String(left[key]).localeCompare(String(right[key]));
      if (result) return result * direction;
    }
    return 0;
  });
  const update = (collection, filter, changes, options, one) => {
    assert.ok(options.session); assert.equal(options.runValidators, true);
    if (fail && collection === 'reports') throw new Error('Lỗi giả lập cập nhật báo cáo');
    let rows = view(options.session)[collection].filter(row => matches(row, filter));
    if (one) rows = rows.slice(0, 1);
    rows.forEach(row => {
      Object.assign(row, copy(changes.$set ?? {}));
      for (const [key, amount] of Object.entries(changes.$inc ?? {})) row[key] = (row[key] ?? 0) + amount;
    });
    return { matchedCount: rows.length, modifiedCount: rows.length, row: rows[0] };
  };
  const model = collection => ({
    find: filter => query((session, order) => copy(sort(view(session)[collection].filter(row => matches(row, filter)), order))),
    findOne: filter => query((session, order) => copy(sort(view(session)[collection].filter(row => matches(row, filter)), order)[0] ?? null)),
    countDocuments: filter => query(session => view(session)[collection].filter(row => matches(row, filter)).length),
    updateOne: (filter, changes, options) => query(() => update(collection, filter, changes, options, true)),
    updateMany: (filter, changes, options) => query(() => update(collection, filter, changes, options, false)),
    findOneAndUpdate: (filter, changes, options) => query(() => update(collection, filter, changes, options, true).row),
    aggregate: async () => {
      const groups = new Map();
      for (const row of state.conversations.filter(row => !row.isDeleted)) {
        const key = `${row.customerId}:${row.providerId}`;
        const group = groups.get(key) ?? { _id: { customerId: row.customerId, providerId: row.providerId }, count: 0 };
        group.count++; groups.set(key, group);
      }
      return [...groups.values()].filter(group => group.count > 1);
    },
  });
  const connection = { connect: async () => {}, disconnect: async () => {}, mongo: mongoose.mongo,
    startSession: async () => ({
      async withTransaction(work) {
        this.snapshot = copy(state);
        const result = await work();
        Object.assign(state, this.snapshot); return result;
      }, endSession: async () => {},
    }) };
  const modules = { 'dotenv/config': {}, mongoose: { __esModule: true, default: connection },
    'node:fs': { mkdirSync: () => {}, writeFileSync: (_path, content) => backups.push(EJSON.parse(content)) },
    '../utils/transaction': { withTransactionRetry: (session, work) => session.withTransaction(work) },
  };
  for (const [name, collection] of [['Conversation', 'conversations'], ['Message', 'messages'], ['Provider', 'providers'], ['Order', 'orders'], ['Report', 'reports']]) {
    modules[`../models/${name.toLowerCase()}.model`] = { [name]: model(collection) };
  }
  let source = fs.readFileSync(require.resolve('./mergeDuplicateConversations.ts'), 'utf8');
  source = source.slice(0, source.lastIndexOf('\nrun().catch')) + '\nexports.completion = run();';
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText,
    { exports, Date, console: { log: (...values) => logs.push(values) }, process: { argv: apply ? ['--apply'] : [], env: { MONGO_URI: 'mongodb://gia-lap' } },
      require: name => name in modules ? modules[name] : require(name) });
  await exports.completion;
  return { backups, logs };
}

(async () => {
  const state = initial(), original = copy(state);
  assert.equal((await execute(state, false)).backups.length, 0);
  assert.deepEqual(state, original, 'Xem trước không ghi dữ liệu.');
  const result = await execute(state, true);
  assert.equal(result.backups.length, 1);
  assert.equal(result.backups[0].messages.length, 3);
  assert.equal(state.messages.length, original.messages.length);
  for (let index = 0; index < state.messages.length; index++) {
    const { conversationId, ...message } = state.messages[index];
    const { conversationId: oldId, ...before } = original.messages[index];
    assert.deepEqual(message, before, 'Giữ nguyên ID, nội dung, thời gian và trạng thái xóa của từng tin.');
    assert.equal(String(conversationId), String(oldest));
  }
  assert.equal(state.conversations[1].isDeleted, true);
  assert.equal(state.conversations[2].isDeleted, false);
  assert.equal(String(state.conversations[0].lastMessage.messageId), String(state.messages[1]._id));
  assert.equal(String(state.conversations[0].orderId), String(newOrder));
  assert.equal(state.conversations[0].customerLastSeenAt.getTime(), date(5).getTime());
  assert.equal(state.conversations[0].providerLastSeenAt, null);
  assert.equal(String(state.reports[0].conversationId), String(oldest));
  assert.equal((await execute(state, true)).backups.length, 0, 'Chạy lại không gộp thêm.');
  const invalid = initial(); invalid.messages[1].senderId = unrelated;
  await execute(invalid, true);
  assert.equal(invalid.conversations[1].isDeleted, false, 'Không gộp lịch sử có người gửi không khớp.');
  const validExtraId = id();
  invalid.conversations.push({ ...copy(invalid.conversations[0]), _id: validExtraId, createdAt: date(5) });
  invalid.messages.push({ ...copy(invalid.messages[0]), _id: id(), conversationId: validExtraId });
  await execute(invalid, true);
  assert.equal(invalid.conversations[1].isDeleted, false, 'Chat có lịch sử khác người vẫn giữ riêng.');
  assert.equal(invalid.conversations[3].isDeleted, true, 'Vẫn xử lý các chat hợp lệ trong cùng nhóm.');
  assert.equal(String(invalid.messages.at(-1).conversationId), String(oldest));
  const failing = initial(), beforeFailure = copy(failing);
  await assert.rejects(execute(failing, true, true), /Lỗi giả lập/);
  assert.deepEqual(failing, beforeFailure, 'Lỗi giữa chừng hoàn tác toàn bộ giao dịch.');
  console.log('Đạt: xem trước, sao lưu, gộp bảo toàn tin nhắn, chuyển báo cáo, chạy lại, chặn gộp sai người và hoàn tác khi lỗi.');
})().catch(error => { console.error(error); process.exitCode = 1; });
