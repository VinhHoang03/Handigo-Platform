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
  console.log('Đạt bộ quét điều phối: không chạy chồng, không tạo timer trùng và phục hồi sau lỗi.');
})().catch(error => { console.error(error); process.exitCode = 1; });
