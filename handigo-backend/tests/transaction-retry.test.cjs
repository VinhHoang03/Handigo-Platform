const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function setup() {
  let now = 0;
  const delays = [];
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/utils/transaction.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const math = Object.create(Math);
  math.random = () => 0;
  vm.runInNewContext(code, { exports, Date: { now: () => now }, Math: math,
    require(name) {
      if (name === 'node:timers/promises') return { setTimeout: async ms => { delays.push(ms); now += ms; } };
      if (name === './logger') return { createLogger: () => ({ warn() {} }) };
      throw new Error(`Chưa giả lập ${name}`);
    },
  });
  return { ...exports, delays, advance: ms => { now += ms; } };
}

test('WriteConflict thử lại toàn bộ với ngân sách thời gian giảm dần', async () => {
  const runtime = setup();
  const timeouts = [];
  let attempts = 0;
  const operation = async () => 'thành công';
  const session = { async withTransaction(callback, options) {
    assert.equal(callback, operation);
    timeouts.push(options.timeoutMS);
    if (++attempts === 1) { runtime.advance(1200); throw { code: 112 }; }
    return callback();
  } };
  assert.equal(await runtime.withTransactionRetry(session, operation), 'thành công');
  assert.deepEqual(timeouts, [5000, 3775]);
});

test('Xung đột kéo dài dừng sau ba lượt', async () => {
  const runtime = setup();
  let attempts = 0;
  const conflict = { code: 112 };
  await assert.rejects(runtime.withTransactionRetry({ withTransaction: async () => {
    attempts++; throw conflict;
  } }, async () => {}), error => error === conflict);
  assert.equal(attempts, 3);
});

test('Hết ngân sách không tiếp tục thử lại', async () => {
  const runtime = setup();
  let attempts = 0;
  const conflict = { code: 112 };
  await assert.rejects(runtime.withTransactionRetry({ withTransaction: async (_, options) => {
    attempts++;
    assert.equal(options.timeoutMS, 5000);
    runtime.advance(5000);
    throw conflict;
  } }, async () => {}), error => error === conflict);
  assert.equal(attempts, 1);
});

test('Kết quả commit chưa rõ và lỗi nghiệp vụ được trả ra ngay', async () => {
  for (const failure of [
    { code: 112, errorLabels: ['UnknownTransactionCommitResult'] },
    { code: 112, hasErrorLabel: label => label === 'UnknownTransactionCommitResult' },
    new Error('Lỗi nghiệp vụ'),
  ]) {
    const runtime = setup();
    let attempts = 0;
    await assert.rejects(runtime.withTransactionRetry({ withTransaction: async () => {
      attempts++; throw failure;
    } }, async () => {}), error => error === failure);
    assert.equal(attempts, 1);
    assert.equal(runtime.delays.length, 0);
  }
});
