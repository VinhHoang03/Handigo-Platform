const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Chạy bộ quét thật với đồng hồ giả và nguồn cấu hình có thể chậm/thất bại.
const source = fs.readFileSync(require.resolve('../services/dispatch.service'), 'utf8');
const ast = ts.createSourceFile('dispatch.ts', source, ts.ScriptTarget.Latest, true);
const declaration = ast.statements.flatMap(node => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [])
  .find(node => node.name.getText(ast) === 'DispatchService');
const method = declaration.initializer.properties.find(node => node.name?.getText(ast) === 'startTimeoutMonitor');
let tick;
let fail;
let calls = 0;
const errors = [];
const context = { exports: {}, timeoutMonitor: null, MATCHING_TIMEOUT_SCAN_INTERVAL_MS: 10000, Date,
  setInterval: fn => { tick = fn; return { unref() {} }; },
  getNumberConfigValue: () => { calls++; return new Promise((_resolve, reject) => { fail = reject; }); },
  dispatchLogger: { error: (...args) => errors.push(args) },
};
vm.runInNewContext(ts.transpileModule(`exports.monitor = { ${method.getText(ast)} };`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const flush = () => new Promise(setImmediate);
async function testOverdueReview() {
  const rows = [null, undefined, {}, { escalatedAt: null }, { escalatedAt: new Date() }]
    .map((overdueReview, index) => ({ _id: String(index), orderCode: `TEST-${index}`,
      customerId: 'customer', providerId: 'provider', status: 'in_progress', isDeleted: false, updatedAt: new Date(), overdueReview }));
  const notifications = [];
  const failures = [];
  let nextTick;
  let assignmentScans = 0;
  const query = values => ({ select() { return this; }, sort() { return this; }, limit() { return this; },
    lean: async () => values, then: (resolve, reject) => Promise.resolve(values).then(resolve, reject) });
  const overdueContext = { exports: {}, timeoutMonitor: null, MATCHING_TIMEOUT_SCAN_INTERVAL_MS: 10000, Date,
    setInterval: fn => { nextTick = fn; return { unref() {} }; },
    getNumberConfigValue: async (_key, fallback) => fallback,
    findOverdueOrders: async () => rows.filter(row => !row.overdueReview?.escalatedAt),
    dispatchLogger: { error: (...args) => failures.push(args) },
    Order: {
      find: filter => query(filter.status === 'in_progress' ? rows.filter(row => !row.overdueReview?.escalatedAt) : []),
      findOneAndUpdate: async (filter, update, options) => {
        const row = rows.find(value => value._id === filter._id);
        assert.equal(filter['overdueReview.escalatedAt'], null);
        assert.equal(filter.updatedAt, row.updatedAt);
        assert.equal(options.runValidators, true);
        if (row.overdueReview?.escalatedAt) return null;
        if ('overdueReview.escalatedAt' in update.$set) {
          if (row.overdueReview === null) throw new Error("Cannot create field 'escalatedAt' in element {overdueReview: null}");
          row.overdueReview = { ...row.overdueReview, escalatedAt: update.$set['overdueReview.escalatedAt'] };
        } else Object.assign(row, update.$set);
        return row;
      },
    },
    Provider: { findById: () => ({ select: () => ({ lean: async () => ({ userId: 'provider-user' }) }) }) },
    User: { find: () => query([{ _id: 'admin' }]) },
    OrderAssignment: { find: () => { assignmentScans++; return query([]); } },
    createNotificationRecord: async value => { notifications.push(value); },
  };
  vm.runInNewContext(ts.transpileModule(`exports.monitor = { ${method.getText(ast)} };`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, overdueContext);
  overdueContext.exports.monitor.startTimeoutMonitor();
  await flush();
  assert.equal(failures.length, 0, 'Không lỗi khi overdueReview là null, thiếu hoặc chưa có thời điểm');
  assert.ok(rows.every(row => row.overdueReview?.escalatedAt instanceof Date));
  assert.equal(notifications.length, 12, 'Bốn đơn mới quá hạn thông báo cho khách, thợ và quản trị viên');
  assert.equal(assignmentScans, 1, 'Tiếp tục quét timeout điều phối sau khi xử lý đơn quá hạn');
  nextTick(); await flush();
  assert.equal(notifications.length, 12, 'Không gửi lại thông báo ở lượt quét tiếp theo');
  assert.equal(assignmentScans, 2);
}
async function testPendingOrderConflict() {
  const rows = [{ _id: 'don-xung-dot', status: 'created' }, { _id: 'don-ke-tiep', status: 'created' }];
  const processed = [];
  const failures = [];
  const conflict = Object.assign(new Error('Xung đột ghi giả lập sau khi hết lượt retry'), { code: 112 });
  let nextTick;
  let shouldFail = true;
  const query = values => ({ select() { return this; }, sort() { return this; }, limit() { return this; }, lean: async () => values });
  const pendingContext = { exports: {}, timeoutMonitor: null, MATCHING_TIMEOUT_SCAN_INTERVAL_MS: 10000, Date,
    setInterval: fn => { nextTick = fn; return { unref() {} }; },
    getNumberConfigValue: async (_key, fallback) => fallback,
    findOverdueOrders: async () => [],
    dispatchLogger: { debug() {}, error: (...args) => failures.push(args) },
    Order: { find: filter => query(filter.matchingStartedAt?.$ne === null ? rows.filter(row => row.status === 'created') : []) },
    OrderAssignment: { find: () => query([]), exists: async () => false },
    getDispatchContext: async () => ({}),
    getTriedProviderState: async () => ({ attemptNumber: 2, triedProviderIds: [] }),
    DispatchService: { dispatchOrder: async id => {
      processed.push(id);
      if (id === 'don-xung-dot' && shouldFail) { shouldFail = false; throw conflict; }
      rows.find(row => row._id === id).status = id === 'don-xung-dot' ? 'cancelled' : 'accepted';
    } },
  };
  vm.runInNewContext(ts.transpileModule(`exports.monitor = { ${method.getText(ast)} };`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, pendingContext);
  pendingContext.exports.monitor.startTimeoutMonitor();
  await flush();
  assert.deepEqual(processed, ['don-xung-dot', 'don-ke-tiep'], 'Một đơn xung đột không chặn đơn phía sau trong cùng lượt quét.');
  assert.equal(failures.length, 1);
  assert.equal(failures[0][1], conflict, 'Giữ lỗi gốc để chẩn đoán.');
  assert.equal(failures[0][2].orderId, 'don-xung-dot');
  assert.equal(rows[0].status, 'created', 'Không tự đổi trạng thái đơn khi giao dịch thất bại.');
  nextTick(); await flush();
  assert.deepEqual(processed, ['don-xung-dot', 'don-ke-tiep', 'don-xung-dot'], 'Lượt quét sau xử lý lại đơn lỗi, không xử lý lại đơn đã nhận.');
  assert.equal(rows[0].status, 'cancelled');
  assert.equal(failures.length, 1);
}
(async () => {
  context.exports.monitor.startTimeoutMonitor();
  context.exports.monitor.startTimeoutMonitor();
  tick(); tick();
  assert.equal(calls, 1, 'Lượt định kỳ không chạy chồng lên lượt khởi động còn chờ');
  fail(new Error('Lỗi nguồn cấu hình giả lập')); await flush();
  tick();
  assert.equal(calls, 2, 'Nhả cờ đang quét cả khi lượt trước thất bại');
  fail(new Error('Lỗi nguồn cấu hình giả lập')); await flush();
  assert.equal(errors.length, 2);
  await testOverdueReview();
  await testPendingOrderConflict();
  console.log('Đạt bộ quét điều phối: không chạy chồng, không tạo timer trùng và phục hồi sau lỗi.');
})().catch(error => { console.error(error); process.exitCode = 1; });
