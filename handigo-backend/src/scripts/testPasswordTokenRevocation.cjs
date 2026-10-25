const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Types } = require('mongoose');
const User = require('../models/user.model').default;
const { AppError } = require('../utils/appError');
const otp = require('../utils/otp');

// Dùng JWT, bcrypt và document Mongoose thật; không kết nối database hay dịch vụ ngoài.
const testProcess = { env: { ACCESS_TOKEN_SECRET: 'kiem-thu-co-lap-khong-dung-secret-that' } };
function load(file, resolve) {
  const context = { exports: {}, require: resolve, process: testProcess, Date, Map, Set, setTimeout, clearTimeout };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, context);
  return context.exports;
}
const token = load('../utils/token', name => require(name));
let stored;
let failSave = false;
let failRevoke = false;
const sessions = new Map();
const activeSockets = new Set();
let handshake;
let connected;
class SocketServer {
  use(handler) { handshake = handler; }
  on(event, handler) { if (event === 'connection') connected = handler; }
  in(room) {
    return { disconnectSockets: () => {
      for (const socket of activeSockets) if (socket.room === room) socket.disconnect(true);
    } };
  }
}
const socketServer = load('../sockets/socketServer', name => {
  if (name === '../utils/logger') return { createLogger: () => ({ error() {} }) };
  return {};
});
function document() {
  const user = User.hydrate(stored);
  user.save = async () => {
    if (failSave) throw new Error('Lỗi lưu giả lập');
    const changes = user.$getChanges();
    assert.equal(changes.$inc.tokenVersion, 1, 'Tăng phiên bản nguyên tử cùng lần lưu mật khẩu.');
    assert.ok(changes.$set.passwordHash);
    stored = user.toObject();
    return user;
  };
  return user;
}
const query = () => Object.assign(Promise.resolve(document()), {
  select: () => query(), lean: () => Promise.resolve({ ...stored }),
});
const users = { findOne: () => query(), findById: () => query() };
const sessionModel = {
  updateOne: async (filter, update) => sessions.set(String(filter._id), { ...filter, ...update }),
  updateMany: async (_filter, update) => {
    if (failRevoke) throw new Error('Lỗi thu hồi giả lập');
    for (const session of sessions.values()) session.revokedAt = update.revokedAt;
  },
  findOne: async filter => {
    const row = sessions.get(String(filter._id));
    return row && !row.revokedAt && row.refreshTokenHash === filter.refreshTokenHash ? row : null;
  },
};
const auth = load('../services/auth.service', name => {
  if (name === '../models/user.model') return { default: users, __esModule: true };
  if (name === '../models/session.model') return { Session: sessionModel };
  if (name === '../utils/token') return token;
  if (name === '../utils/otp') return otp;
  if (name === '../utils/appError') return { AppError };
  if (name === '../sockets/socketServer') return socketServer;
  if (name === './providerPresence.service') return { markProviderOffline: async () => {} };
  if (name.startsWith('.')) return {};
  return require(name);
});
const { authMiddleware } = load('../middlewares/auth.middleware', name => {
  if (name === '../models/user.model') return { default: users, __esModule: true };
  if (name === '../utils/token') return token;
  if (name === '../utils/orderActorContext') return { orderActorContext: { run: (_actor, next) => next() } };
  return require(name);
});
const { initSocket } = load('../sockets/initSocket', name => {
  if (name === 'socket.io') return { Server: SocketServer };
  if (name === '../models/user.model') return { default: users, __esModule: true };
  if (name === '../utils/token') return token;
  if (name === './socketServer') return socketServer;
  if (name === '../utils/logger') return { createLogger: () => ({ warn() {}, error() {} }) };
  if (name.startsWith('.')) return {};
  return require(name);
});
initSocket({});
function httpStatus(accessToken) {
  return new Promise((resolve, reject) => {
    const res = { status(code) { this.code = code; return this; }, json() { resolve(this.code); } };
    authMiddleware({ headers: { authorization: `Bearer ${accessToken}` } }, res, error => error ? reject(error) : resolve(200));
  });
}
async function socketConnect(accessToken) {
  const socket = {
    handshake: { auth: { token: accessToken } }, disconnected: false,
    on() {}, use(handler) { this.packet = handler; },
    join(room) { this.room = room; activeSockets.add(this); },
    disconnect() { this.disconnected = true; activeSockets.delete(this); },
  };
  const error = await new Promise(resolve => handshake(socket, resolve));
  if (!error) connected(socket);
  await new Promise(setImmediate);
  return { socket, error };
}
async function run() {
  for (const operation of ['change', 'reset']) {
    sessions.clear();
    stored = { _id: new Types.ObjectId(), email: 'kiemthu@example.test', fullName: 'Khách Kiểm Thử',
      role: 'CUSTOMER', status: 'active', isDeleted: false, isEmailVerified: true,
      passwordHash: await bcrypt.hash('mat-khau-cu', 10) };
    const legacy = jwt.sign({ id: String(stored._id), role: 'CUSTOMER' }, testProcess.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
    const before = await auth.login(stored.email, 'mat-khau-cu');
    const second = await auth.login(stored.email, 'mat-khau-cu');
    assert.equal(await httpStatus(legacy), 200);
    assert.equal(await httpStatus(before.token), 200);
    const opened = await socketConnect(before.token);
    assert.equal(opened.error, undefined);

    if (operation === 'change') {
      await assert.rejects(auth.changePassword(String(stored._id), 'sai-mat-khau', 'mat-khau-moi'));
    } else {
      stored.resetPasswordOtp = otp.hashOtp('123456');
      stored.resetPasswordOtpExpire = new Date(Date.now() + 60000);
      await assert.rejects(auth.resetPassword(stored.email, '000000', 'mat-khau-moi'));
    }
    assert.equal(await httpStatus(before.token), 200, 'Thao tác thất bại không thu hồi token.');
    failSave = true;
    await assert.rejects(operation === 'change'
      ? auth.changePassword(String(stored._id), 'mat-khau-cu', 'mat-khau-moi')
      : auth.resetPassword(stored.email, '123456', 'mat-khau-moi'));
    failSave = false;
    assert.equal(await httpStatus(before.token), 200, 'Lưu thất bại không tăng phiên bản trong database.');

    await (operation === 'change'
      ? auth.changePassword(String(stored._id), 'mat-khau-cu', 'mat-khau-moi')
      : auth.resetPassword(stored.email, '123456', 'mat-khau-moi'));
    assert.equal(stored.tokenVersion, 1);
    assert.equal(opened.socket.disconnected, true, 'Socket đang mở phải bị ngắt ngay.');
    for (const old of [legacy, before.token, second.token]) {
      assert.equal(await httpStatus(old), 401);
      assert.ok((await socketConnect(old)).error);
    }
    for (const old of [before.refreshToken, second.refreshToken]) {
      await assert.rejects(auth.refreshToken(old), error => error.statusCode === 401);
    }
    assert.ok([...sessions.values()].every(session => session.revokedAt));
    await assert.rejects(auth.login(stored.email, 'mat-khau-cu'));
    const after = await auth.login(stored.email, 'mat-khau-moi');
    assert.equal(jwt.decode(after.token).tokenVersion, 1);
    assert.equal(await httpStatus(after.token), 200);
    const refreshed = await auth.refreshToken(after.refreshToken);
    assert.equal(await httpStatus(refreshed.token), 200);
    const current = await socketConnect(after.token);
    assert.equal(current.error, undefined);
    // Dù socket bỏ lỡ lệnh ngắt, mỗi gói tin vẫn kiểm tra phiên bản hiện tại.
    stored.tokenVersion = 2;
    const packetError = await new Promise(resolve => current.socket.packet([], resolve));
    assert.ok(packetError);
    assert.equal(current.socket.disconnected, true);
  }
  // Thu hồi session gặp lỗi vẫn không khôi phục được quyền của token cũ.
  const latest = await auth.login(stored.email, 'mat-khau-moi');
  failRevoke = true;
  await assert.rejects(auth.changePassword(String(stored._id), 'mat-khau-moi', 'mat-khau-tiep'));
  failRevoke = false;
  assert.equal(await httpStatus(latest.token), 401);
  await assert.rejects(auth.refreshToken(latest.refreshToken), error => error.statusCode === 401);
  // Đổi mật khẩu sau bắt tay nhưng trước khi vào room vẫn phải đóng kết nối.
  const pendingToken = token.signAccessToken(document());
  const pending = {
    handshake: { auth: { token: pendingToken } }, on() {}, use() {},
    join(room) { this.room = room; activeSockets.add(this); },
    disconnect() { this.disconnected = true; activeSockets.delete(this); },
  };
  assert.equal(await new Promise(resolve => handshake(pending, resolve)), undefined);
  await auth.changePassword(String(stored._id), 'mat-khau-tiep', 'mat-khau-cuoi');
  connected(pending);
  await new Promise(setImmediate);
  assert.equal(pending.disconnected, true);
  console.log('Đạt: đổi/reset mật khẩu thu hồi access/refresh token nhiều phiên, token cũ và socket; đăng nhập mới vẫn hoạt động.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
