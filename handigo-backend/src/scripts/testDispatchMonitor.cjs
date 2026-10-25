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
      customerId: 'customer', providerId: 'provider', status: 'in_progress', isDeleted: false, overdueReview }));
  const notifications = [];
  const failures = [];
  let nextTick;
  let assignmentScans = 0;
  const query = values => ({ select() { return this; }, sort() { return this; }, limit() { return this; },
    lean: async () => values, then: (resolve, reject) => Promise.resolve(values).then(resolve, reject) });
  const overdueContext = { exports: {}, timeoutMonitor: null, MATCHING_TIMEOUT_SCAN_INTERVAL_MS: 10000, Date,
    setInterval: fn => { nextTick = fn; return { unref() {} }; },
    getNumberConfigValue: async (_key, fallback) => fallback,
    dispatchLogger: { error: (...args) => failures.push(args) },
    Order: {
      find: filter => query(filter.status === 'in_progress' ? rows.filter(row => !row.overdueReview?.escalatedAt) : []),
      findOneAndUpdate: async (filter, update, options) => {
        const row = rows.find(value => value._id === filter._id);
        assert.equal(filter['overdueReview.escalatedAt'], null);
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
  console.log('Đạt bộ quét điều phối: không chạy chồng, không tạo timer trùng và phục hồi sau lỗi.');
})().catch(error => { console.error(error); process.exitCode = 1; });
