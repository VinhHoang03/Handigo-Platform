const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const filename = path.join(__dirname, '../src/utils/orderReschedule.ts');
const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exportsObject = {};
vm.runInNewContext(code, { exports: exportsObject, Date, Math, require: () => ({}) }, { filename });

test('Mỗi phía chỉ có một lượt, yêu cầu bị từ chối vẫn mất lượt', () => {
  assert.equal(exportsObject.canUseRescheduleQuota(0), true);
  assert.equal(exportsObject.canUseRescheduleQuota(1), false);
  assert.equal(exportsObject.rescheduleConsumesQuota('applied'), true);
  assert.equal(exportsObject.rescheduleConsumesQuota('rejected'), true);
  for (const status of ['pending', 'cancelled', 'expired', 'conflicted']) {
    assert.equal(exportsObject.rescheduleConsumesQuota(status), false);
  }
});

test('Cảnh báo provider xuất hiện ở yêu cầu có thể trở thành lần thứ ba trong tháng', () => {
  assert.equal(exportsObject.requiresProviderMonthlyWarning(0, 3), false);
  assert.equal(exportsObject.requiresProviderMonthlyWarning(1, 3), false);
  assert.equal(exportsObject.requiresProviderMonthlyWarning(2, 3), true);
  assert.equal(exportsObject.requiresProviderMonthlyWarning(3, 3), true);
});

test('Ranh giới tháng được tính theo giờ Việt Nam', () => {
  const october = exportsObject.getVietnamMonthBounds(new Date('2026-10-31T16:59:59.000Z'));
  assert.equal(october.start.toISOString(), '2026-09-30T17:00:00.000Z');
  assert.equal(october.end.toISOString(), '2026-10-31T17:00:00.000Z');
  const november = exportsObject.getVietnamMonthBounds(new Date('2026-10-31T17:00:00.000Z'));
  assert.equal(november.start.toISOString(), '2026-10-31T17:00:00.000Z');
  assert.equal(november.end.toISOString(), '2026-11-30T17:00:00.000Z');
});
