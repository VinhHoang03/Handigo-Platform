const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const address = { fullAddress: 'abc, Phường Bến Nghé, Thành phố Hồ Chí Minh', ward: 'Phường Bến Nghé', province: 'Thành phố Hồ Chí Minh' };
const area = { fullAddress: 'Bến Nghé, Hồ Chí Minh, Việt Nam', province: 'Hồ Chí Minh',
  administrativeNames: ['Bến Nghé'], wardNames: ['Bến Nghé'], category: 'boundary', latitude: 10.78, longitude: 106.7 };
const place = { ...area, category: 'building', matchLevel: 'building', matchCode: 'exact', latitude: 10.79, longitude: 106.71 };

function setup(results) {
  const queries = [];
  const filename = path.join(__dirname, '../src/services/agentAddressResolver.service.ts');
  const exports = {};
  class AppError extends Error { constructor(message, statusCode) { super(message); this.statusCode = statusCode; } }
  const modules = {
    './vietnamAddress.service': {}, '../utils/appError': { AppError },
    './reverseGeocoding.service': { searchAddressLocations: async query => {
      queries.push(query);
      const result = results[queries.length - 1];
      if (result instanceof Error) throw result;
      return result ?? [];
    } },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: name => modules[name] }, { filename });
  return { suggest: exports.suggestAddressMapLocation, queries };
}

test('Địa chỉ cụ thể tìm được đặt ghim đúng địa điểm, không tra lại tâm phường', async () => {
  const runtime = setup([[place]]);
  const result = await runtime.suggest(address);
  assert.equal(result.latitude, place.latitude);
  assert.equal(result.fullAddress, address.fullAddress);
  assert.equal(runtime.queries.length, 1);
  assert.equal(runtime.queries[0], `${address.fullAddress}, Việt Nam`);
});

test('Địa chỉ abc không có kết quả thì tự đặt ghim theo phường và thành phố đã chọn', async () => {
  const runtime = setup([[], [area]]);
  const result = await runtime.suggest(address);
  assert.equal(runtime.queries[1], 'Phường Bến Nghé, Thành phố Hồ Chí Minh, Việt Nam');
  assert.equal(result.latitude, area.latitude);
  assert.equal(result.longitude, area.longitude);
  assert.equal(result.fullAddress, address.fullAddress);
  assert.equal(result.ward, address.ward);
  assert.equal(result.province, address.province);
  assert.equal(result.placeId, undefined);
});

test('Không đặt ghim vào địa điểm hoặc phường cùng tên thuộc tỉnh khác', async () => {
  const runtime = setup([[{ ...place, province: 'Hà Nội' }], [{ ...area, province: 'Hà Nội' }], [area]]);
  const result = await runtime.suggest(address);
  assert.equal(result.latitude, area.latitude);
  assert.equal(runtime.queries[2], 'ben nghe, ho chi minh, Việt Nam');
});

test('Kết quả đoán gần đúng cho địa chỉ nhập bừa phải chuyển về phường đã chọn', async () => {
  const runtime = setup([[{ ...place, matchCode: 'fallback' }], [area]]);
  assert.equal((await runtime.suggest(address)).latitude, area.latitude);
  assert.equal(runtime.queries.length, 2);
});

test('Đường tìm được đúng phường được ưu tiên; kết quả khác phường được bỏ qua', async () => {
  const wrongWard = { ...place, fullAddress: 'Phường khác, Hồ Chí Minh', administrativeNames: ['Phường khác'] };
  const road = { ...place, category: 'highway', matchLevel: 'street' };
  const runtime = setup([[wrongWard, road]]);
  assert.equal((await runtime.suggest(address)).latitude, road.latitude);
  assert.equal(runtime.queries.length, 1);
});

test('Không tìm được khu vực hoặc dịch vụ gián đoạn không tự bịa tọa độ', async () => {
  const unavailable = setup([new Error('Dịch vụ bản đồ gián đoạn')]);
  await assert.rejects(unavailable.suggest(address), /gián đoạn/);
  const missing = setup([[], [], []]);
  await assert.rejects(missing.suggest(address), error => error.statusCode === 422);
});
