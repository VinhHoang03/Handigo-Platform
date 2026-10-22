const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
require('ts-node').register({ transpileOnly: true, project: path.join(__dirname, '../tsconfig.json') });
const { AppError } = require('../src/utils/appError');
const { sendControllerError } = require('../src/utils/controllerError');
const { httpErrorMessages } = require('../src/utils/httpErrorMessages');
const { z } = require('zod');

function response(error, options) {
  const res = { status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
  sendControllerError(res, error, options);
  return res;
}

for (const status of Object.keys(httpErrorMessages).map(Number)) {
  test(`HTTP ${status}: trả đúng mã và thông báo an toàn`, () => {
    const result = response(Object.assign(new Error('Thông tin kỹ thuật không được công khai'), { statusCode: status }));
    assert.equal(result.statusCode, status);
    assert.equal(result.body.code, `HTTP_${status}`);
    if (status >= 500) assert.equal(result.body.message, httpErrorMessages[status]);
  });
}

test('Giữ mã và thông báo lỗi nghiệp vụ đã xác định ở trạng thái 503', () => {
  const result = response(new AppError('Dịch vụ xác định địa chỉ chưa được cấu hình.', 503, 'GEO_NOT_CONFIGURED'));
  assert.equal(result.body.code, 'GEO_NOT_CONFIGURED');
  assert.match(result.body.message, /chưa được cấu hình/);
});

test('Lỗi không xác định, mã không hợp lệ và mã lạ không làm lộ chi tiết', () => {
  for (const statusCode of [undefined, 0, 200, 600, 400.5, NaN]) {
    const result = response(Object.assign(new Error('Thông tin kỹ thuật'), { statusCode }));
    assert.equal(result.statusCode, 500);
    assert.equal(result.body.code, 'HTTP_500');
    assert.equal(result.body.message, httpErrorMessages[500]);
  }
  assert.equal(response({ statusCode: 599 }).body.code, 'HTTP_599');
});

test('Lỗi validation giữ errors và có mã riêng', () => {
  const invalid = z.object({ name: z.string() }).safeParse({});
  const result = response(invalid.error);
  assert.equal(result.statusCode, 400);
  assert.equal(result.body.code, 'VALIDATION_ERROR');
  assert.ok(result.body.errors.length);
});

test('Giữ tương thích mã nghiệp vụ và fallbackMessage hiện có', () => {
  const result = response(Object.assign(new Error('Đơn đã thay đổi'), { statusCode: 409, code: 'ORDER_CHANGED' }), { includeCode: true });
  assert.equal(result.body.code, 'ORDER_CHANGED');
  assert.equal(response(new Error('Thông tin kỹ thuật'), { fallbackMessage: 'Không thể xử lý yêu cầu.' }).body.message, 'Không thể xử lý yêu cầu.');
});

function geo(failure, configured = true, data = { error: 'Không tìm thấy' }) {
  const filename = path.join(__dirname, '../src/services/reverseGeocoding.service.ts');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const exports = {};
  let tick = 0;
  const axios = { get: async (_, options) => { if (failure) throw failure; return { data: typeof data === 'function' ? data(options) : data }; }, isAxiosError: error => error?.isAxiosError === true };
  vm.runInNewContext(code, { exports, setTimeout, Map, Promise, Date: { now: () => (tick += 1001) }, process: { env: configured ? { LOCATIONIQ_API_KEY: 'gia-lap-kiem-thu' } : {} }, require(name) {
    if (name === 'axios') return axios;
    if (name === '../utils/appError') return { AppError };
    if (name === '../utils/logger') return { createLogger: () => ({ error() {} }) };
    throw new Error(`Module chưa được giả lập: ${name}`);
  } }, { filename });
  return exports.reverseGeocode;
}

for (const [failure, code, status] of [
  [{ isAxiosError: true, response: { status: 401 } }, 'GEO_AUTH_REJECTED', 503],
  [{ isAxiosError: true, response: { status: 403 } }, 'GEO_AUTH_REJECTED', 503],
  [{ isAxiosError: true, response: { status: 429 } }, 'GEO_RATE_LIMITED', 503],
  [{ isAxiosError: true, response: { status: 404 } }, 'GEO_ADDRESS_NOT_FOUND', 422],
  [{ isAxiosError: true, code: 'ECONNABORTED' }, 'GEO_TIMEOUT', 502],
  [{ isAxiosError: true, code: 'ETIMEDOUT' }, 'GEO_TIMEOUT', 502],
  [{ isAxiosError: true, response: { status: 504 } }, 'GEO_TIMEOUT', 502],
  [{ isAxiosError: true, code: 'ENOTFOUND' }, 'GEO_CONNECTION_FAILED', 502],
  [{ isAxiosError: true, response: { status: 500 } }, 'GEO_SERVICE_UNAVAILABLE', 502],
]) {
  test(`Tra địa chỉ: phân loại ${code} (${failure.code ?? failure.response.status})`, async () => {
    await assert.rejects(geo(failure)({ latitude: 16.05, longitude: 108.2 }), error => error.code === code && error.statusCode === status);
  });
}

test('Tra địa chỉ thiếu cấu hình được nhận diện, không đọc cấu hình thật', async () => {
  await assert.rejects(geo(null, false)({ latitude: 16.05, longitude: 108.2 }), error => error.code === 'GEO_NOT_CONFIGURED');
});

test('Tra địa chỉ không có kết quả và tọa độ không hợp lệ có mã riêng', async () => {
  await assert.rejects(geo()({ latitude: 16.05, longitude: 108.2 }), error => error.code === 'GEO_ADDRESS_NOT_FOUND');
  await assert.rejects(geo()({ latitude: 100, longitude: 108.2 }), error => error.code === 'GEO_INVALID_COORDINATES');
});

test('Tra địa chỉ phân biệt phản hồi thiếu phường và phản hồi thành công', async () => {
  const data = { display_name: '45 Lê Hữu Trác, An Hải, Đà Nẵng', address: { state: 'Thành phố Đà Nẵng', suburb: 'An Hải' } };
  const result = await geo(null, true, data)({ latitude: 16.05, longitude: 108.2 });
  assert.equal(result.latitude, 16.05);
  assert.equal(result.ward, 'An Hải');
  await assert.rejects(geo(null, true, { ...data, address: { state: 'Thành phố Đà Nẵng' } })({ latitude: 16.05, longitude: 108.2 }), error => error.code === 'GEO_ADDRESS_INCOMPLETE');
});

for (const [display, house, expected] of [
  ['Đường Lê Hữu Trác, An Hải, Đà Nẵng', '45', '45 Đường Lê Hữu Trác, An Hải, Đà Nẵng'],
  ['45 Đường Lê Hữu Trác, An Hải, Đà Nẵng', '45', '45 Đường Lê Hữu Trác, An Hải, Đà Nẵng'],
  ['45, Đường Lê Hữu Trác, An Hải, Đà Nẵng', '45', '45, Đường Lê Hữu Trác, An Hải, Đà Nẵng'],
  ['Đường Lê Hữu Trác, An Hải, Đà Nẵng', '45/2A', '45/2A Đường Lê Hữu Trác, An Hải, Đà Nẵng'],
  ['Đường Lê Hữu Trác, An Hải, Đà Nẵng', undefined, 'Đường Lê Hữu Trác, An Hải, Đà Nẵng'],
]) {
  test(`Số nhà ${house ?? 'không có'}: bổ sung khi có dữ liệu, không lặp hoặc tự đoán (${display})`, async () => {
    const data = { display_name: display, address: { state: 'Thành phố Đà Nẵng', suburb: 'An Hải', road: 'Đường Lê Hữu Trác', house_number: house } };
    const result = await geo(null, true, data)({ latitude: 16.05, longitude: 108.2 });
    assert.equal(result.fullAddress, expected);
  });
}

test('Hai điểm ghim gần nhau không dùng chung cache địa chỉ của hai nhà', async () => {
  let calls = 0;
  const resolve = geo(null, true, () => ({ display_name: 'Lê Hữu Trác, An Hải, Đà Nẵng', address: {
    state: 'Thành phố Đà Nẵng', suburb: 'An Hải', road: 'Lê Hữu Trác', house_number: String(45 + calls++ * 2),
  } }));
  const first = await resolve({ latitude: 16.050001, longitude: 108.2 });
  const second = await resolve({ latitude: 16.050009, longitude: 108.2 });
  assert.match(first.fullAddress, /^45 /);
  assert.match(second.fullAddress, /^47 /);
  assert.equal(calls, 2);
});
