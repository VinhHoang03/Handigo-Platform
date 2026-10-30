const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, modules) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { exports, require: name => modules[name] ?? {} });
  return exports;
}
const schema = load('validations/bookingPolicy.validator.ts', { zod: require('zod') });
class AppError extends Error { constructor(message, statusCode) { super(message); this.statusCode = statusCode; } }
function configuration(saved) {
  return load('services/systemConfig.service.ts', {
    mongoose: { __esModule: true, default: { connection: { collection: () => ({
      findOne: async ({ key }) => saved?.[key] ?? null, createIndex: async () => 'key_unique',
      find: () => ({ toArray: async () => Object.entries(saved ?? {}).map(([key, value]) => ({ key, ...value })) }),
    }) } } },
    '../validations/bookingPolicy.validator': schema,
    '../utils/appError': { AppError },
  });
}

test('Ba cấu hình chưa lưu giữ mặc định 200 mét, 10 phút, 5 phút độc lập với chính sách đặt lịch', async () => {
  for (const saved of [null, { BOOKING_POLICY: { type: 'JSON', value: { defaultDurationMinutes: 90 } } }]) {
    const policy = await configuration(saved).getOrderOperationPolicy();
    assert.equal(policy.providerArrivalRadiusMeters, 200);
    assert.equal(policy.customerNoShowWaitMinutes, 10);
    assert.equal(policy.customerCancellationMinutes, 5);
  }
});

test('Đọc giá trị admin đã lưu, từ chối số âm, 0, số lẻ, sai kiểu và vượt giới hạn trước khi ghi', async () => {
  const custom = { PROVIDER_ARRIVAL_RADIUS_METERS: { type: 'NUMBER', value: 350, isPublic: false },
    CUSTOMER_NO_SHOW_WAIT_MINUTES: { type: 'NUMBER', value: 7, isPublic: false },
    CUSTOMER_CANCELLATION_MINUTES: { type: 'NUMBER', value: 12, isPublic: false } };
  const policy = await configuration(custom).getOrderOperationPolicy();
  assert.equal(policy.providerArrivalRadiusMeters, 350);
  assert.equal(policy.customerNoShowWaitMinutes, 7);
  assert.equal(policy.customerCancellationMinutes, 12);
  for (const [key, maximum] of [['PROVIDER_ARRIVAL_RADIUS_METERS', 10000], ['CUSTOMER_NO_SHOW_WAIT_MINUTES', 1440], ['CUSTOMER_CANCELLATION_MINUTES', 1440]]) {
    for (const value of [-1, 0, 1.5, '10', maximum + 1]) {
      const input = { key, type: 'NUMBER', isPublic: false, value };
      await assert.rejects(configuration(null).createConfig({ role: 'ADMIN' }, input), /số nguyên nội bộ/);
      await assert.rejects(configuration(custom).updateConfig({ role: 'ADMIN' }, key, input), /số nguyên nội bộ/);
    }
  }
  await assert.rejects(configuration(null).createConfig({ role: 'CUSTOMER' }, {
    key: 'CUSTOMER_CANCELLATION_MINUTES', type: 'NUMBER', isPublic: false, value: 12,
  }), error => error.statusCode === 403);
});

test('Điều khoản khách nhận đúng hạn hủy và đổi phiên bản xác nhận khi admin thay thời gian', async () => {
  let customerCancellationMinutes = 5;
  const service = load('services/bookingPolicy.service.ts', {
    './systemConfig.service': {
      getBookingPolicy: async () => schema.DEFAULT_BOOKING_POLICY,
      getOrderOperationPolicy: async () => ({ customerCancellationMinutes }),
      getRefundPolicy: async () => ({}), getNumberConfigValue: async (_, fallback) => fallback,
    },
    '../utils/matchingSearch': { getProviderResponseTimeoutSeconds: seconds => seconds },
    'node:crypto': require('node:crypto'),
  });
  const before = await service.getCustomerBookingPolicies();
  customerCancellationMinutes = 8;
  const after = await service.getCustomerBookingPolicies();
  assert.equal(after.customerCancellationMinutes, 8);
  assert.notEqual(after.version, before.version);
  assert.equal(after.providerCalendars, undefined);
});
