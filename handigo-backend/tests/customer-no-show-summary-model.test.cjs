const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const mongoose = require('mongoose');
const modelExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/models/report.model.ts'), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText, { exports: modelExports, require: name => name === 'mongoose' ? mongoose : { baseFields: {} } });
const { Report } = modelExports;
const verification = () => ({ decision: 'auto_eligible', reasons: ['Đủ điều kiện.'],
  checkedAt: new Date('2026-10-28T03:10:00Z'), policyVersion: 'HANDIGO_NO_SHOW_AI_V4' });
function makeReport(noShowVerification) {
  return new Report({ reporterId: new mongoose.Types.ObjectId(), targetType: 'order', reportType: 'spam_booking',
    title: 'Khách không có mặt', description: 'Không liên hệ được khách.', noShowVerification });
}

test('Schema giữ được kết quả lịch sử của cả bốn điều kiện qua bước serialize', () => {
  const report = makeReport({ ...verification(), checks: {
    location: { passed: true, distanceMeters: 98.8, radiusMeters: 200 },
    waiting: { passed: true, skippedForTesting: false, waitStartedAt: new Date('2026-10-28T03:00:00Z'), requiredMinutes: 10 },
    calls: { passed: true, validCount: 3, requiredCount: 3 },
    chat: { passed: true, messageCount: 1, customerReplied: false },
  } });
  assert.equal(report.validateSync(), undefined);
  const stored = JSON.parse(JSON.stringify(report));
  assert.equal(stored.noShowVerification.checks.location.distanceMeters, 98.8);
  assert.equal(stored.noShowVerification.checks.waiting.waitStartedAt, '2026-10-28T03:00:00.000Z');
  assert.equal(stored.noShowVerification.checks.calls.validCount, 3);
  assert.equal(stored.noShowVerification.checks.chat.customerReplied, false);
});

test('Hồ sơ cũ không có kết quả từng điều kiện vẫn hợp lệ, không tự sinh kết quả đạt', () => {
  const report = makeReport(verification());
  assert.equal(report.validateSync(), undefined);
  assert.equal(report.toObject().noShowVerification.checks, null);
  assert.equal(makeReport(null).validateSync(), undefined);
});
