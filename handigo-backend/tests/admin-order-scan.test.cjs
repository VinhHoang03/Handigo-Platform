const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('Chỉ xử lý sau xác nhận của đúng admin, bỏ qua đơn đã thay đổi và chặn dùng lại báo cáo', async () => {
  const filename = path.join(__dirname, '../src/controllers/systemConfig.controller.ts');
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const exports = {};
  const original = new Date('2026-11-12T02:00:00Z');
  const processed = [];
  const modules = {
    'node:crypto': require('node:crypto'),
    '../middlewares/authContext': { requireRequestUser: req => ({ id: req.admin }) },
    '../utils/appError': { AppError: Error },
    '../models/order.model': { Order: { find: () => ({ select: () => ({ lean: async () => [
      { _id: 'valid', updatedAt: original },
      { _id: 'changed', updatedAt: new Date(original.getTime() + 1000) },
    ] }) }) } },
    '../services/dispatch.service': { DispatchService: {
      previewOrderScan: async () => ['valid', 'changed'].map(id => ({ id, updatedAt: original })),
      scanOrders: async ids => { processed.push(...ids); return { failed: 0 }; },
    } },
  };
  vm.runInNewContext(outputText, { exports, Date, Map, require: name => modules[name] ?? {} }, { filename });
  const call = (action, admin, body) => new Promise((resolve, reject) => {
    const response = { set: () => response, json: resolve };
    void action({ admin, body }, response, reject);
  });
  const preview = await call(exports.previewOrderScan, 'admin-a');
  assert.equal(preview.data.rows.length, 2);
  assert.equal(processed.length, 0);
  await assert.rejects(call(exports.scanOrders, 'admin-b', { token: preview.data.token }), /quét lại/);
  const result = await call(exports.scanOrders, 'admin-a', { token: preview.data.token });
  assert.equal(result.data.skipped, 1);
  assert.deepEqual(processed, ['valid']);
  await assert.rejects(call(exports.scanOrders, 'admin-a', { token: preview.data.token }), /quét lại/);
});
