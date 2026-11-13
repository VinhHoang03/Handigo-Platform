const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { Types } = require('mongoose');

function load(file, modules) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Date, Map, Set, Boolean, Number, Promise,
    process: { env: { ACCESS_TOKEN_SECRET: 'gia-lap' } },
    require(name) {
      assert.ok(name in modules, `Chưa giả lập module ${name}`);
      return modules[name];
    },
  });
  return exports;
}

class AppError extends Error {
  constructor(message, statusCode) { super(message); this.statusCode = statusCode; }
}

function dashboard({ status = 'offline', conflict = false } = {}) {
  const events = [], updates = [];
  const service = load('services/dashboard.service.ts', {
    mongoose: { Types },
    '../models/order.model': {}, '../models/payment.model': {}, '../models/wallet.model': {},
    '../models/walletTransaction.model': {}, '../models/withdrawRequest.model': {},
    '../utils/appError': { AppError },
    '../sockets/socketServer': { emitToUser: (...args) => events.push(args) },
    '../models/provider.model': { Provider: {
      findOne: async () => ({ _id: 'provider', availabilityStatus: status }),
      findOneAndUpdate(filter, update, options) {
        updates.push({ filter, update, options });
        return { lean: async () => conflict ? null : { availabilityStatus: update.$set.availabilityStatus } };
      },
    } },
  });
  return { service, events, updates };
}

test('Bật nhận việc cập nhật có điều kiện và thông báo mọi phiên', async () => {
  const runtime = dashboard();
  const userId = new Types.ObjectId().toString();
  const result = await runtime.service.updateProviderAvailability({ id: userId }, 'online');
  assert.equal(result.availabilityStatus, 'online');
  assert.equal(runtime.updates[0].filter.availabilityStatus.$in[0], 'offline');
  assert.equal(runtime.updates[0].options.runValidators, true);
  assert.equal(runtime.events[0][0], userId);
  assert.equal(runtime.events[0][1], 'provider:availability');
});

test('Không ghi đè trạng thái bận hoặc trạng thái vừa đổi do nhận đơn', async () => {
  for (const options of [{ status: 'busy' }, { conflict: true }]) {
    const runtime = dashboard(options);
    await assert.rejects(runtime.service.updateProviderAvailability({ id: new Types.ObjectId().toString() }, 'online'),
      error => error.statusCode === 409);
    assert.equal(runtime.events.length, 0);
  }
});

function auth(otherSession) {
  let offline = 0;
  const disconnected = [], signedSessions = [];
  const userId = new Types.ObjectId();
  const service = load('services/auth.service.ts', {
    bcrypt: { compare: async () => true }, crypto: require('node:crypto'),
    axios: {}, 'google-auth-library': {}, mongoose: { Types },
    jsonwebtoken: { verify: () => ({ id: String(userId), sessionId: 'session' }), decode: () => ({ exp: 2000000000 }) },
    '../models/user.model': { __esModule: true, default: { findOne: async () => ({
      _id: userId, role: 'PROVIDER', status: 'active', isEmailVerified: true, passwordHash: 'gia-lap',
    }) } },
    '../models/session.model': { Session: {
      updateOne: async () => {}, findOneAndUpdate: async () => ({}), exists: async () => otherSession,
    } },
    '../models/wallet.model': {}, '../utils/otp': {}, '../utils/mail': {}, '../utils/profileValidation': {},
    '../utils/token': { getRefreshSecret: () => 'gia-lap', signRefreshToken: () => 'gia-lap',
      signAccessToken: (_, sessionId) => { signedSessions.push(sessionId); return 'gia-lap'; } },
    '../utils/appError': { AppError },
    './providerPresence.service': { markProviderOffline: async () => { offline++; } },
    '../sockets/socketServer': { disconnectSessionSockets: id => disconnected.push(id) },
    './penaltyPolicy.service': { refreshAccountLock: async () => {} },
    '../utils/userRole': { getEffectiveUserRole: user => user.role },
  });
  return { service, disconnected, signedSessions, offline: () => offline };
}

test('Đăng nhập provider giữ nhận việc và gắn access token với phiên', async () => {
  const runtime = auth(true);
  await runtime.service.login('provider@example.test', 'gia-lap');
  assert.equal(runtime.offline(), 0);
  assert.ok(runtime.signedSessions[0]);
});

test('Đăng xuất chỉ ngắt socket của phiên đó và giữ provider nếu còn phiên khác', async () => {
  const runtime = auth(true);
  await runtime.service.logout('gia-lap');
  assert.deepEqual(runtime.disconnected, ['session']);
  assert.equal(runtime.offline(), 0);
});

test('Đăng xuất phiên cuối mới tắt nhận việc', async () => {
  const runtime = auth(false);
  await runtime.service.logout('gia-lap');
  assert.equal(runtime.offline(), 1);
});

test('Điều phối tức thời loại provider mất kết nối, lịch hẹn vẫn có thể chọn ngoại tuyến', async () => {
  const userId = new Types.ObjectId();
  let locationReads = 0;
  let connectedIds = [], locationFilter;
  const service = load('services/matching.service.ts', {
    mongoose: { Types }, '../models/provider.model': {},
    '../models/location.model': { Location: { find: filter => { locationReads++; locationFilter = filter; return { lean: async () => [] }; } } },
    '../models/service.model': {},
    './systemConfig.service': { getNumberConfigValue: async () => 10, getBookingPolicy: async () => ({ travelMinutes: 30 }) },
    './providerWalletEligibility.service': { getEligibleProviderUserIds: async () => [userId] },
    '../utils/logger': { createLogger: () => ({ info() {} }) },
    './providerSchedule.service': {}, '../utils/bookingPolicy': { calculateDuration: () => 60 },
    '../sockets/socketServer': { getOnlineUserIds: async () => connectedIds },
  });
  const options = { serviceId: String(new Types.ObjectId()), latitude: 10, longitude: 106,
    scheduleIntervals: [], province: '', ward: '' };
  await service.MatchingService.findNearestProviders(options);
  assert.equal(locationReads, 0);
  connectedIds = [String(userId)];
  await service.MatchingService.findNearestProviders(options);
  assert.ok(locationFilter.lastUpdatedAt.$gte instanceof Date);
  connectedIds = [];
  await service.MatchingService.findNearestProviders({ ...options, requireOnline: false });
  assert.equal(locationReads, 2);
  assert.equal(locationFilter.lastUpdatedAt, undefined);
});

test('Socket kiểm tra phiên đã thu hồi và chỉ vào phòng của đúng phiên đã xác thực', async () => {
  const user = { _id: new Types.ObjectId(), email: 'provider@example.test', role: 'PROVIDER', status: 'active' };
  let active = true, authenticate, connected;
  class Server {
    use(handler) { authenticate = handler; }
    on(event, handler) { if (event === 'connection') connected = handler; }
  }
  const service = load('sockets/initSocket.ts', {
    jsonwebtoken: { verify: () => ({ id: String(user._id), sessionId: 'session' }) },
    'socket.io': { Server },
    '../models/user.model': { __esModule: true, default: { findOne: () => ({
      then: (resolve, reject) => Promise.resolve(user).then(resolve, reject),
      select() { return this; }, lean: async () => user,
    }) } },
    '../models/session.model': { Session: { exists: async () => active } },
    '../services/chat.service': {}, '../services/orderTracking.service': {},
    './socketServer': { setSocketServer() {} }, '../configs/cors': {},
    '../validations/chat.validator': {}, '../validations/location.validator': {}, '../validations/order.validator': {},
    '../utils/logger': { createLogger: () => ({ warn() {} }) },
    '../utils/token': { isTokenVersionCurrent: () => true },
    '../services/penaltyPolicy.service': { refreshAccountLock: async () => {} },
    '../utils/userRole': { getEffectiveUserRole: account => account.role },
  });
  service.initSocket({});
  const rooms = [];
  let packet, disconnected = false;
  const socket = { handshake: { auth: { token: 'gia-lap' } },
    on() {}, use(handler) { packet = handler; }, join: room => rooms.push(room),
    disconnect: () => { disconnected = true; },
  };
  await authenticate(socket, error => assert.ifError(error));
  connected(socket);
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(rooms.includes('session:session'));
  active = false;
  await packet([], error => assert.ok(error));
  assert.equal(disconnected, true);
  await authenticate({ handshake: socket.handshake }, error => assert.match(error.message, /Phiên đăng nhập/));
});
