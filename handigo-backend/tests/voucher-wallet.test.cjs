const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { Types } = require('mongoose');

function setup() {
  const userId = String(new Types.ObjectId());
  let usageFilter, publicFilter, pagination, relation;
  const usages = [{ _id: new Types.ObjectId(), discountAmount: 10000, status: 'used', usedAt: new Date(),
    orderId: { _id: new Types.ObjectId(), orderCode: 'HD123', voucherSnapshot: { name: 'Ưu đãi', code: 'WELCOME10' } } }];
  const modules = {
    mongoose: { Types }, '../models/auditLog.model': {}, '../models/payment.model': {},
    '../models/promotion.model': {}, '../models/voucher.model': {}, '../utils/bookingPolicy': {},
    '../utils/appError': {}, './penaltyPolicy.service': {},
    '../models/order.model': { Order: { find: () => ({ select() { return this; }, lean: async () => [] }) } },
    '../models/voucherUsage.model': { VoucherUsage: {
      find(filter) {
        usageFilter = filter;
        return {
          sort(value) { assert.equal(value.usedAt, -1); return this; },
          skip(value) { pagination = { skip: value }; return this; },
          limit(value) { pagination.limit = value; return this; },
          populate(value) { relation = value; return this; },
          lean: async () => usages,
        };
      },
      countDocuments: async () => 13,
      aggregate: async () => [],
    } },
    './voucherStore.service': { listStoredVouchers: async filter => { publicFilter = filter; return []; } },
  };
  const filename = path.join(__dirname, '../src/services/voucher.service.ts');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Date, Map, Set, Math, require(name) {
    assert.ok(name in modules, `Chưa giả lập ${name}`);
    return modules[name];
  } });
  return { service: exports, user: { id: userId, role: 'CUSTOMER' }, usages,
    filter: () => usageFilter, publicFilter: () => publicFilter,
    pagination: () => pagination, relation: () => relation };
}

test('Lịch sử voucher chỉ lấy đúng tài khoản, có phân trang và số tiền thực tế', async () => {
  const runtime = setup();
  const result = await runtime.service.getVoucherUsageHistory(runtime.user, 2);
  assert.equal(String(runtime.filter().userId), runtime.user.id);
  assert.equal(runtime.filter().isDeleted, false);
  assert.equal(runtime.filter().status.$in.join(','), 'used,cancelled_not_restored');
  assert.equal(runtime.relation().match.customerId, runtime.user.id);
  assert.deepEqual(runtime.pagination(), { skip: 12, limit: 12 });
  assert.equal(result.items[0].code, 'WELCOME10');
  assert.equal(result.items[0].discountAmount, 10000);
  assert.equal(result.pagination.totalPages, 2);
});

test('Lịch sử cũ thiếu đơn hoặc snapshot vẫn hiển thị an toàn', async () => {
  const runtime = setup();
  runtime.usages[0].orderId = null;
  const result = await runtime.service.getVoucherUsageHistory(runtime.user, 1);
  assert.equal(result.items[0].name, 'Voucher đã sử dụng');
  assert.equal(result.items[0].orderId, null);
  assert.equal(result.items[0].code, '');
});

test('Kho công khai loại voucher riêng, truy vấn cũ vẫn lấy được voucher sở hữu', async () => {
  const runtime = setup();
  await runtime.service.getAvailableVouchers(runtime.user, { source: 'public' });
  assert.equal(runtime.publicFilter().$and[0].ownerId, null);
  await runtime.service.getAvailableVouchers(runtime.user, {});
  assert.equal(String(runtime.publicFilter().$and[0].$or[1].ownerId), runtime.user.id);
});
