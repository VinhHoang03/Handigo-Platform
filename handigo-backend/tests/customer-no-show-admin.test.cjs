const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const timeExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/utils/customerNoShowEvidence.ts'), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText, { exports: timeExports, Date });

function setup(options = {}) {
  const filters = {};
  const order = { _id: 'don', addressId: 'dia-chi', arrival: { latitude: 10.8, longitude: 106.7, arrivedAt: new Date() },
    addressSnapshot: { fullAddress: '12 Nguyễn Trãi', latitude: 10.8, longitude: 106.7 },
    customerNoShow: { evidenceIds: ['anh-da-gui'] }, ...options.order };
  const query = value => ({ select() { return this; }, lean() { return Promise.resolve(value); } });
  const modules = {
    './systemConfig.service': { getOrderOperationPolicy: async () => ({ providerArrivalRadiusMeters: 200 }) },
    '../utils/customerNoShowEvidence': timeExports,
    '../utils/logger': { createLogger: () => ({ warn() {} }) },
    '../models/user.model': { __esModule: true, default: { findOne: () => query({ phone: options.customerPhone ?? '0773368198' }) } },
    '../models/order.model': { Order: { findOne: filter => { filters.order = filter; return query(options.missingOrder ? null : order); } } },
    '../models/customerNoShowEvidence.model': { CustomerNoShowEvidence: { find: filter => { filters.evidence = filter;
      return query([{ _id: 'anh-da-gui', kind: 'contact', url: 'https://example.com/anh.jpg', sha256: 'bi-mat',
        uploadedAt: options.uploadedAt,
        analysisStatus: options.unavailable ? 'unavailable' : 'analyzed', analysisFailure: options.failure ?? null,
        analysis: options.unavailable ? null : options.analysis ?? { providerMessage: 'Tôi đã đến nơi.' } }]); } } },
    '../models/address.model': { Address: { findOne: () => query(null) } },
    './matching.service': { haversineMeters: () => options.distance ?? 100 },
    '../utils/customerNoShow': { CUSTOMER_NO_SHOW_ARRIVAL_RADIUS_METERS: 200, CUSTOMER_NO_SHOW_SKIP_WAIT_FOR_TESTING: options.skipWait ?? true },
    './reverseGeocoding.service': { reverseGeocode: async () => { if (options.geocodeFails) throw new Error('Lỗi bản đồ');
      return { fullAddress: '10 Nguyễn Trãi', attribution: 'Nguồn bản đồ' }; } },
  };
  const filename = path.join(__dirname, '../src/services/customerNoShowVerification.service.ts');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => modules[name] ?? {} }, { filename });
  return { filters, read: () => exports.getAdminNoShowDetails({ _id: 'bao-cao', orderId: { _id: 'don' }, reporterId: { _id: 'tho' },
    noShowVerification: options.checkedAt ? { checkedAt: options.checkedAt } : null }) };
}

test('Admin thấy dữ liệu AI theo ảnh đã gửi và địa chỉ từ vị trí đến nơi; không lộ mã băm', async () => {
  const { read, filters } = setup();
  const result = await read();
  assert.equal(result.location.arrivalAddress, '10 Nguyễn Trãi');
  assert.equal(result.location.orderAddress, '12 Nguyễn Trãi');
  assert.equal(result.location.distanceMeters, 100);
  assert.equal(result.location.withinRadius, true);
  assert.equal(result.evidence[0].analysis.providerMessage, 'Tôi đã đến nơi.');
  assert.equal(result.evidence[0].sha256, undefined);
  assert.equal(filters.order['customerNoShow.reportId'], 'bao-cao');
  assert.equal(filters.evidence.providerUserId, 'tho');
  assert.equal(filters.evidence.orderId, 'don');
  assert.equal(filters.evidence._id.$in.join(','), 'anh-da-gui');
});

for (const [distance, expected] of [[200, true], [200.1, false], [250, false]]) {
  test(`Khoảng cách ${distance} m có kết quả phạm vi đúng`, async () => {
    assert.equal((await setup({ distance }).read()).location.withinRadius, expected);
  });
}

test('Lỗi bản đồ hoặc AI không ngăn admin xem ảnh và khoảng cách', async () => {
  const result = await setup({ geocodeFails: true, unavailable: true }).read();
  assert.equal(result.location.arrivalAddress, null);
  assert.equal(result.location.withinRadius, true);
  assert.equal(result.evidence[0].analysisStatus, 'unavailable');
  assert.equal(result.evidence[0].analysis, null);
});

test('Thiếu tọa độ không được hiển thị là trong phạm vi', async () => {
  const result = await setup({ order: { addressSnapshot: { fullAddress: '12 Nguyễn Trãi' } } }).read();
  assert.equal(result.location.distanceMeters, null);
  assert.equal(result.location.withinRadius, null);
});

test('Báo cáo cũ thiếu mốc đến nơi vẫn xem được ảnh', async () => {
  const result = await setup({ order: { arrival: null } }).read();
  assert.equal(result.location.arrivalAddress, null);
  assert.equal(result.location.withinRadius, null);
  assert.equal(result.evidence.length, 1);
});

test('Không lấy dữ liệu đơn không còn liên kết báo cáo', async () => {
  assert.equal(await setup({ missingOrder: true }).read(), null);
});

test('Admin nhận lý do lỗi AI an toàn; ảnh cũ thiếu chi tiết lỗi vẫn tương thích', async () => {
  const result = await setup({ unavailable: true, failure: { reason: 'Gemini giới hạn lượt gọi hoặc hạn mức', httpStatus: 429 } }).read();
  assert.equal(result.evidence[0].analysisFailure.httpStatus, 429);
  assert.equal(result.evidence[0].analysisFailure.reason, 'Gemini giới hạn lượt gọi hoặc hạn mức');
  assert.equal((await setup({ unavailable: true }).read()).evidence[0].analysisFailure, null);
});

test('Admin nhận từng cuộc gọi và ngày quy đổi neo lúc tải ảnh, không suy theo ngày mở hồ sơ', async () => {
  const result = await setup({ uploadedAt: new Date('2030-01-26T00:10:00+07:00'), analysis: {
    imageType: 'call', contactAt: null, calls: [{ phoneNumber: '0900000000', dateLabel: 'Hôm qua', time: '23:59',
      occurredAt: null, direction: 'outgoing', outcome: 'no_answer' }],
  } }).read();
  assert.equal(result.evidence[0].callEvents[0].dateLabel, 'Hôm qua');
  assert.equal(result.evidence[0].callEvents[0].resolvedAt, '2030-01-25T16:59:00.000Z');
  assert.equal(result.evidence[0].callEvents[0].direction, 'outgoing');
  assert.equal(result.evidence[0].resolvedContactAt, null);
});

test('Admin thấy đúng số đối chiếu, mốc thời gian và lý do 0/3 hoặc 3/3 ngay trên báo cáo cũ', async () => {
  const options = { uploadedAt: new Date('2026-10-26T22:24:00+07:00'), checkedAt: new Date('2026-10-26T22:25:00+07:00'),
    order: { orderType: 'scheduled', scheduledAt: new Date('2026-10-27T08:00:00+07:00'),
      arrival: { latitude: 10.8, longitude: 106.7, arrivedAt: new Date('2026-10-26T22:19:07.985+07:00') },
      addressSnapshot: { fullAddress: 'Nam Kỳ Khởi Nghĩa', recipientPhone: '0773368198', latitude: 10.8, longitude: 106.7 } },
    analysis: { imageType: 'call', calls: ['22:22', '22:21', '22:20', '22:20'].map(time => ({ phoneNumber: '+84773368198',
      dateLabel: 'Hôm nay', time, occurredAt: null, direction: 'outgoing', outcome: 'no_answer' })) } };
  const valid = (await setup(options).read()).callComparison;
  assert.equal(valid.expectedPhone, '0773368198');
  assert.equal(valid.phoneSource, 'order_recipient');
  assert.equal(valid.waitStartedAt.toISOString(), '2026-10-26T15:19:07.985Z');
  assert.equal(valid.validCount, 3);
  assert.match(valid.events[3].failures.join(), /cùng phút/);
  const outside = (await setup({ ...options, skipWait: false }).read()).callComparison;
  assert.equal(outside.validCount, 0);
  assert.match(outside.events[0].failures.join(), /ngoài khoảng/);
  const mismatch = (await setup({ ...options, order: { ...options.order,
    addressSnapshot: { ...options.order.addressSnapshot, recipientPhone: '0911111111' } } }).read()).callComparison;
  assert.equal(mismatch.validCount, 0);
  assert.match(mismatch.events[0].failures.join(), /không khớp/);
  const updatedAccount = (await setup({ ...options, customerPhone: '0773368198', order: { ...options.order, customerId: 'khach',
    addressSnapshot: { ...options.order.addressSnapshot, recipientPhone: '0345643125' } } }).read()).callComparison;
  assert.equal(updatedAccount.expectedPhone, '0773368198');
  assert.equal(updatedAccount.phoneSource, 'customer_account');
  assert.equal(updatedAccount.validCount, 3);
});

test('Admin lấy đúng nguồn số tài khoản khi đơn không có số người nhận', async () => {
  const result = await setup({ order: { customerId: 'khach' } }).read();
  assert.equal(result.callComparison.expectedPhone, '0773368198');
  assert.equal(result.callComparison.phoneSource, 'customer_account');
});

test('Chỉ chi tiết admin được bổ sung kết quả AI; API của người báo cáo giữ nguyên', async () => {
  const id = '507f1f77bcf86cd799439011';
  const report = { isCustomerNoShow: true, toObject: () => ({ _id: id, isCustomerNoShow: true }) };
  let calls = 0;
  const modules = {
    mongoose: require('mongoose'),
    '../models/provider.model': { Provider: { findOne: () => ({ select: async () => null }) } },
    '../models/report.model': { Report: { findOne: () => ({ populate: async () => report }) } },
    './customerNoShowVerification.service': { getAdminNoShowDetails: async () => { calls++; return { evidence: [] }; } },
  };
  const filename = path.join(__dirname, '../src/services/report.service.ts');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => modules[name] ?? {} }, { filename });
  assert.equal(await exports.getReportForUser(id, id), report);
  assert.equal(calls, 0);
  assert.ok((await exports.getAdminReportById(id)).noShowDetails);
  assert.equal(calls, 1);
});
