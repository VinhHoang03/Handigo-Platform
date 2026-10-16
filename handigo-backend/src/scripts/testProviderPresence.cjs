const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Chạy xử lý kết nối thật với socket, database và đồng hồ được cô lập.
const timers = new Set();
const offline = [];
const restored = [];
const emitted = [];
let restoreResult = true;
let markOffline = async () => new Date('2030-01-01T00:00:00Z');
let activeSockets = [];
let fetchSockets = async () => activeSockets;
let connection;
class FakeServer {
  use() {}
  on(event, callback) { if (event === 'connection') connection = callback; }
  in() { return { fetchSockets: () => fetchSockets() }; }
  to(room) { return { emit: (event, payload) => emitted.push({ room, event, payload }) }; }
}
const modules = {
  'socket.io': { Server: FakeServer },
  '../sockets/socketServer': { setSocketServer() {} },
  './socketServer': { setSocketServer() {} },
  '../services/providerPresence.service': {
    markProviderOffline: async (...args) => { offline.push(args); return markOffline(); },
    restoreProviderAfterReconnect: async (...args) => { restored.push(args); return restoreResult; },
  },
  '../utils/logger': { createLogger: () => ({ error() {}, warn() {}, info() {} }) },
};
const source = fs.readFileSync(require.resolve('../sockets/initSocket'), 'utf8');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, {
  exports: exportsObject, require: name => modules[name] ?? {},
  setTimeout: (callback, ms) => { const timer = { callback, ms, unref() {} }; timers.add(timer); return timer; },
  clearTimeout: timer => timers.delete(timer),
});
exportsObject.initSocket({});
const connect = (role = 'PROVIDER') => {
  const events = new Map();
  const socket = { user: { id: 'tho-kiem-thu', role }, use() {}, join() {}, on: (event, callback) => events.set(event, callback) };
  connection(socket);
  return { disconnect: () => events.get('disconnect')() };
};
(async () => {
  const first = connect(); first.disconnect();
  const timer = [...timers].at(-1);
  assert.equal(timer.ms, 30000, 'Cho phép kết nối lại trong 30 giây');
  connect();
  assert.equal(timers.has(timer), false, 'Kết nối mới hủy lịch chuyển offline cũ');
  await timer.callback();
  assert.equal(offline.length, 0);

  const racing = connect(); racing.disconnect();
  const racingTimer = [...timers].at(-1);
  let resolve;
  fetchSockets = () => new Promise(done => { resolve = done; });
  const pending = racingTimer.callback();
  connect(); resolve([]); await pending;
  assert.equal(offline.length, 0, 'Kết nối mới trong lúc kiểm tra không bị timer cũ tắt online');

  fetchSockets = async () => activeSockets;
  const multiple = connect(); multiple.disconnect(); activeSockets = [{}];
  await [...timers].at(-1).callback();
  assert.equal(offline.length, 0, 'Đóng một socket không tắt thợ còn kết nối khác');
  const absent = connect(); absent.disconnect(); activeSockets = [];
  await [...timers].at(-1).callback();
  assert.deepEqual(offline, [['tho-kiem-thu', true]], 'Chỉ tự chuyển online sang offline khi thực sự mất mọi kết nối');
  activeSockets = [{}];
  connect(); await new Promise(setImmediate);
  assert.equal(restored.length, 1, 'Kết nối lại sau 30 giây phải khôi phục trạng thái bị tắt do mất socket');
  assert.equal(restored[0][1].toISOString(), '2030-01-01T00:00:00.000Z');
  assert.equal(emitted.at(-1).event, 'provider:availability');
  assert.equal(emitted.at(-1).payload.availabilityStatus, 'online', 'Đồng bộ nút nhận việc sau khi khôi phục');
  connect(); await new Promise(setImmediate);
  assert.equal(restored.length, 1, 'Kết nối bổ sung không tự bật nhận việc lần nữa');

  let finishOffline;
  markOffline = () => new Promise(done => { finishOffline = done; });
  activeSockets = [];
  const writing = connect(); writing.disconnect();
  const writePending = [...timers].at(-1).callback();
  await new Promise(setImmediate);
  activeSockets = [{}]; connect();
  finishOffline(new Date('2030-01-02T00:00:00Z'));
  await writePending; await new Promise(setImmediate);
  assert.equal(restored.length, 2, 'Kết nối lại trong lúc ghi offline cũng phải được khôi phục');
  markOffline = async () => new Date('2030-01-03T00:00:00Z');
  restoreResult = false;
  activeSockets = [];
  const changed = connect(); changed.disconnect();
  await [...timers].at(-1).callback();
  const emittedBefore = emitted.length;
  activeSockets = [{}]; connect(); await new Promise(setImmediate);
  assert.equal(emitted.length, emittedBefore, 'Không báo online khi trạng thái đã được thay đổi bằng thao tác khác');
  markOffline = async () => null;
  activeSockets = [];
  const busy = connect(); busy.disconnect();
  await [...timers].at(-1).callback();
  const restoredBefore = restored.length;
  connect(); await new Promise(setImmediate);
  assert.equal(restored.length, restoredBefore, 'Không tạo yêu cầu khôi phục khi thợ không bị socket chuyển offline');
  markOffline = () => new Promise(done => { finishOffline = done; });
  const fleeting = connect(); fleeting.disconnect();
  const fleetingWrite = [...timers].at(-1).callback();
  await new Promise(setImmediate);
  connect();
  finishOffline(new Date('2030-01-03T01:00:00Z'));
  await fleetingWrite; await new Promise(setImmediate);
  assert.equal(restored.length, restoredBefore, 'Không bật online nếu kết nối vừa quay lại đã ngắt trong lúc ghi database');
  activeSockets = [{}]; connect(); await new Promise(setImmediate);
  assert.equal(restored.length, restoredBefore + 1, 'Giữ dấu mất kết nối để khôi phục khi thợ thực sự kết nối lại');
  const before = timers.size;
  connect('CUSTOMER').disconnect();
  assert.equal(timers.size, before, 'Không chạy nghiệp vụ thợ cho khách hàng');

  const updates = [];
  let status = 'online';
  let updatedAt = new Date('2030-01-04T00:00:00Z');
  const provider = {
    findOneAndUpdate: (...args) => {
      updates.push(args);
      return { lean: async () => {
        if (args[0].availabilityStatus && args[0].availabilityStatus !== status) return null;
        status = 'offline'; updatedAt = new Date(updatedAt.getTime() + 1);
        return { updatedAt };
      } };
    },
    updateOne: async (...args) => {
      updates.push(args);
      const filter = args[0];
      if (filter.availabilityStatus !== status || filter.updatedAt.getTime() !== updatedAt.getTime()) return { modifiedCount: 0 };
      status = args[1].$set.availabilityStatus;
      return { modifiedCount: 1 };
    },
  };
  const presenceExports = {};
  const presence = fs.readFileSync(require.resolve('../services/providerPresence.service'), 'utf8');
  vm.runInNewContext(ts.transpileModule(presence, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports: presenceExports, require: () => ({ Provider: provider }) });
  const disconnectedAt = await presenceExports.markProviderOffline('tho-kiem-thu', true);
  assert.equal(updates[0][0].availabilityStatus, 'online', 'Không tự đổi thợ đang bận thành offline');
  assert.equal(updates[0][2].runValidators, true);
  assert.equal(await presenceExports.restoreProviderAfterReconnect('tho-kiem-thu', disconnectedAt), true);
  assert.equal(status, 'online');
  const manualChange = await presenceExports.markProviderOffline('tho-kiem-thu', true);
  updatedAt = new Date(updatedAt.getTime() + 1);
  assert.equal(await presenceExports.restoreProviderAfterReconnect('tho-kiem-thu', manualChange), false, 'Không ghi đè lần chủ động tắt hoặc đăng xuất mới hơn');
  status = 'busy';
  assert.equal(await presenceExports.markProviderOffline('tho-kiem-thu', true), null);
  assert.equal(status, 'busy', 'Không đổi thợ bận thành offline');
  assert.equal(updates.at(-2)[0].verified, true);
  assert.equal(updates.at(-2)[2].runValidators, true);
  console.log('Đạt trạng thái thợ: mất mạng ngắn/dài, nhiều socket, kết nối lại khi đang kiểm tra/ghi offline, khôi phục có điều kiện và bảo toàn thao tác tắt/đăng xuất/bận.');
})().catch(error => { console.error(error); process.exitCode = 1; });
