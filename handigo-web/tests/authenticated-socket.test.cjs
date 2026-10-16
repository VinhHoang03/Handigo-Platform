const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function setup() {
  const source = fs.readFileSync(path.join(__dirname, '../src/realtime/authenticatedSocket.ts'), 'utf8')
    .replaceAll('import.meta.env.DEV', 'true').replaceAll('import.meta.env.VITE_API_BASE_URL', 'undefined');
  const listeners = new Map();
  let connects = 0, refreshes = 0, resolveRefresh, url;
  const socket = { connected: false,
    on: (event, callback) => listeners.set(event, callback), off: event => listeners.delete(event),
    connect: () => connects++, disconnect() {},
  };
  const modules = {
    'socket.io-client': { io: value => { url = value; return socket; } },
    '@/api/client': { refreshAccessToken: () => { refreshes++; return new Promise(resolve => { resolveRefresh = resolve; }); } },
    '@/api/tokenStorage': { tokenStorage: { get: () => 'token-gia-lap' } },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, window: { location: { origin: 'https://handigo.test' } }, require: name => modules[name] });
  const connection = exports.createAuthenticatedSocket();
  return { connection, error: message => listeners.get('connect_error')(new Error(message)),
    resolve: () => resolveRefresh(), stats: () => ({ connects, refreshes, url }) };
}
const flush = () => new Promise(setImmediate);
test('Lỗi xác thực tiếng Việt làm mới token một lần rồi kết nối lại', async () => {
  const runtime = setup();
  assert.equal(runtime.stats().url, 'https://handigo.test');
  runtime.error('Mã xác thực kết nối socket không hợp lệ');
  runtime.error('Mã xác thực kết nối socket không hợp lệ');
  assert.equal(runtime.stats().refreshes, 1);
  runtime.resolve(); await flush();
  assert.equal(runtime.stats().connects, 2);
});
test('Lỗi tài khoản bị khóa không được tự làm mới token để thử vượt quyền', () => {
  const runtime = setup(); runtime.error('Người dùng không được phép kết nối socket');
  assert.equal(runtime.stats().refreshes, 0);
});
test('Socket đã hủy không được kết nối trở lại khi refresh token trả về muộn', async () => {
  const runtime = setup(); runtime.error('Mã xác thực kết nối socket không hợp lệ');
  runtime.connection.dispose(); runtime.resolve(); await flush();
  assert.equal(runtime.stats().connects, 1);
});
