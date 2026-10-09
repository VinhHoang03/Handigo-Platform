import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { parseOptions, startSession } from './dev-app.mjs';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(condition) {
  const deadline = Date.now() + 4000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('Hết thời gian chờ lệnh Flutter.');
    await delay(20);
  }
}

test('Chỉ chấp nhận thiết bị và API an toàn khi gọi Flutter trên Windows', () => {
  assert.equal(parseOptions([]).device, 'emulator-5554');
  assert.equal(parseOptions(['--no-watch']).watch, false);
  assert.equal(parseOptions(['--device', 'emulator-5556', '--api', 'http://192.168.1.10:5000']).api, 'http://192.168.1.10:5000');
  for (const args of [
    ['--device'], ['--device', 'emulator-5554&whoami'], ['--api', 'http://localhost:5000&whoami'],
    ['--api', 'http://user:password@localhost'], ['--api', 'http://localhost?token=abc'],
    ['--api', 'file:///tmp'], ['--api', 'http://%USERNAME%'], ['--release'],
  ]) assert.throws(() => parseOptions(args));
});

test('Theo dõi file ngoài IDE, đợi app sẵn sàng, gom thay đổi và không reload song song', async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'handigo-app-watch-'));
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  const input = new PassThrough();
  const requests = [];
  child.stdin.on('data', (chunk) => requests.push(...JSON.parse(chunk.toString())));
  const session = startSession(child, directory, { input, log: () => {} });
  context.after(async () => {
    session.cleanup();
    await rm(directory, { recursive: true, force: true });
  });
  const emit = (message) => child.stdout.write(`${JSON.stringify([message])}\n`);
  const dartFile = path.join(directory, 'main.dart');

  await writeFile(dartFile, 'void main() {}');
  await delay(550);
  assert.equal(requests.length, 0);
  emit({ event: 'app.start', params: { appId: 'test-app' } });
  emit({ event: 'app.started', params: { appId: 'test-app' } });
  await waitFor(() => requests.length === 1);
  assert.equal(requests[0].method, 'app.restart');
  assert.equal(requests[0].params.appId, 'test-app');
  assert.equal(requests[0].params.fullRestart, false);

  await writeFile(dartFile, 'void main() { print(1); }');
  await writeFile(dartFile, 'void main() { print(2); }');
  await delay(550);
  assert.equal(requests.length, 1);
  emit({ id: requests[0].id, result: { code: 0 } });
  await waitFor(() => requests.length === 2);
  emit({ id: requests[1].id, result: { code: 0 } });
  await writeFile(path.join(directory, 'notes.txt'), 'Không phải mã Dart');
  await delay(550);
  assert.equal(requests.length, 2);

  input.write('R\n');
  await waitFor(() => requests.length === 3);
  assert.equal(requests[2].params.fullRestart, true);
  emit({ id: requests[2].id, error: 'Lỗi biên dịch thử nghiệm' });
  input.write('r\n');
  await waitFor(() => requests.length === 4);
  assert.equal(requests[3].params.fullRestart, false);
  input.write('q\n');
  await waitFor(() => requests.length === 5);
  assert.equal(requests[4].method, 'daemon.shutdown');
  child.emit('close', 0);
  await writeFile(dartFile, 'void main() { print(3); }');
  await delay(550);
  assert.equal(requests.length, 5);
});
