const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const exportsForTest = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/utils/customerNoShowEvidence.ts'), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText, { exports: exportsForTest, Date });
const { resolveNoShowEvidenceTime: resolve } = exportsForTest;

for (const [uploadedAt, dateLabel, time, expected] of [
  ['2030-01-26T20:20:00+07:00', 'Hôm nay', '20:10', '2030-01-26T13:10:00.000Z'],
  ['2030-01-26T00:10:00+07:00', 'Hôm qua', '23:59', '2030-01-25T16:59:00.000Z'],
  ['2030-01-01T00:10:00+07:00', 'Hôm qua', '23:59:30', '2029-12-31T16:59:30.000Z'],
  ['2032-03-01T00:10:00+07:00', 'Hôm qua', '23:59', '2032-02-29T16:59:00.000Z'],
  ['2030-01-26T00:10:00+07:00', '25/01/2030', '23:59', '2030-01-25T16:59:00.000Z'],
]) {
  test(`Quy đổi ${dateLabel} ${time} theo ngày tải ${uploadedAt} và múi giờ Việt Nam`, () => {
    assert.equal(resolve({ dateLabel, time }, new Date(uploadedAt)), expected);
  });
}

for (const event of [
  { dateLabel: 'Hôm nay', time: null }, { dateLabel: 'Hôm nay', time: '25:10' },
  { dateLabel: 'Hôm qua', time: '12:60' }, { dateLabel: 'Hôm qua', time: '12:10:70' },
  { dateLabel: 'Thứ hai', time: '12:00' }, { dateLabel: '31/02/2030', time: '12:00' },
  { dateLabel: 'Hôm nay', time: '23:59' },
  { dateLabel: 'Hôm nay', time: '10:00', occurredAt: '2030-01-25T10:00:00+07:00' },
]) {
  test(`Không suy đoán thời điểm thiếu, sai hoặc mâu thuẫn: ${JSON.stringify(event)}`, () => {
    assert.equal(resolve(event, new Date('2030-01-26T20:20:00+07:00')), null);
  });
}

test('Ngày tương đối thiếu thời điểm tải không được lấy ngày hiện tại để suy đoán', () => {
  assert.equal(resolve({ dateLabel: 'Hôm nay', time: '10:00' }), null);
});

test('Bằng chứng cũ có ngày giờ đầy đủ vẫn được hỗ trợ', () => {
  assert.equal(resolve({ occurredAt: '2030-01-26T10:00:00+07:00' }), '2030-01-26T03:00:00.000Z');
});
