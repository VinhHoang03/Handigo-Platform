const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { Types } = require('mongoose');
const { DEFAULT_BOOKING_POLICY } = require('../validations/bookingPolicy.validator');
const { calculateDuration } = require('../utils/bookingPolicy');

// Cô lập truy vấn vị trí và hồ sơ; không kết nối database hoặc đọc cấu hình bí mật.
const userId = new Types.ObjectId();
const providerId = new Types.ObjectId();
const provider = { _id: providerId, userId, workingAreas: ['Phường kiểm thử, Tỉnh kiểm thử'] };
const location = { userId, coordinates: { coordinates: [106, 10] } };
let nearby = [];
let available = true;
let matchingProfile = true;
let locationQueries = [];
let providerQueries = [];
const modules = {
  mongoose: { Types },
  '../models/provider.model': { Provider: { find: (query) => {
    providerQueries.push(query);
    return { lean: async () => matchingProfile ? [provider] : [] };
  } } },
  '../models/location.model': { Location: { find: (query) => {
    locationQueries.push(query);
    return { lean: async () => nearby };
  } } },
  './systemConfig.service': { getNumberConfigValue: async (_, fallback) => fallback, getBookingPolicy: async () => DEFAULT_BOOKING_POLICY },
  './providerWalletEligibility.service': { getEligibleProviderUserIds: async () => [userId] },
  './providerSchedule.service': { getAvailableProviderIds: async () => new Set(available ? [String(providerId)] : []) },
  '../utils/bookingPolicy': { calculateDuration },
  '../utils/logger': { createLogger: () => ({ info() {}, warn() {} }) },
};
const js = ts.transpileModule(fs.readFileSync(require.resolve('../services/matching.service'), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const context = { exports: {}, require: name => modules[name] || {}, Date, Set, Map };
vm.runInNewContext(js, context);
const { MatchingService } = context.exports;
const options = { serviceId: String(new Types.ObjectId()), latitude: 10, longitude: 106,
  province: 'Tỉnh kiểm thử', ward: 'Phường kiểm thử', scheduleIntervals: [] };

(async () => {
  for (const maxDistanceMeters of [5000, 10000]) {
    nearby = [];
    providerQueries = [];
    const result = await MatchingService.findNearestProviders({ ...options, maxDistanceMeters });
    assert.equal(result.length, 0, 'Không có thợ trong bán kính thì không lấy thợ cùng khu vực thay thế');
    assert.equal(providerQueries.length, 0);
    assert.equal(locationQueries.at(-1).coordinates.$nearSphere.$maxDistance, maxDistanceMeters);
  }
  for (const [latitude, longitude] of [[undefined, undefined], [NaN, 106], [91, 106], [10, 181]]) {
    locationQueries = []; providerQueries = [];
    assert.equal((await MatchingService.findNearestProviders({ ...options, latitude, longitude })).length, 0);
    assert.equal(locationQueries.length, 0);
    assert.equal(providerQueries.length, 0, 'Không điều phối khi không có tọa độ hợp lệ');
  }
  nearby = [location];
  const result = await MatchingService.findNearestProviders({ ...options, maxDistanceMeters: 5000 });
  assert.equal(result.length, 1);
  assert.equal(result[0].distanceMeters, 0);
  assert.equal(String(result[0].providerId), String(providerId));
  available = false;
  assert.equal((await MatchingService.findNearestProviders(options)).length, 0, 'Giữ kiểm tra lịch trống');
  matchingProfile = false;
  providerQueries = [];
  assert.equal((await MatchingService.findNearestProviders(options)).length, 0);
  assert.equal(providerQueries.length, 1, 'Không tìm tiếp bằng khu vực khi hồ sơ trong bán kính không phù hợp');
  console.log('Đã kiểm tra bán kính, tọa độ thiếu/sai, nhánh không có thợ và xung đột lịch.');
})().catch(error => { console.error(error); process.exitCode = 1; });
