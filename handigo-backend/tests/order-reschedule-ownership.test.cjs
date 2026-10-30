const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { Types } = require('mongoose');

const customerId = new Types.ObjectId();
const providerId = new Types.ObjectId();
const providerUserId = new Types.ObjectId();
const chain = value => ({
  select() { return this; }, sort() { return this; },
  lean: async () => value,
  session: async () => value,
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
});

function setup(history = []) {
  const policyExports = {};
  const policyCode = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/utils/orderReschedule.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(policyCode, { exports: policyExports, Date, Math });
  const filename = path.join(__dirname, '../src/services/orderReschedule.service.ts');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  const modules = {
    '../utils/orderReschedule': policyExports,
    mongoose: { Types },
    '../utils/appError': { AppError: class extends Error {
      constructor(message, statusCode) { super(message); this.statusCode = statusCode; }
    } },
    '../models/provider.model': { Provider: {
      findOne: query => chain(String(query.userId) === String(providerUserId) ? { _id: providerId } : null),
    } },
    '../models/orderRescheduleRequest.model': { OrderRescheduleRequest: {
      find: () => chain([]), findOne: () => chain(null),
      countDocuments: query => chain(history.filter(item =>
        (typeof query.status === 'string' ? query.status === item.status : query.status.$in.includes(item.status))
        && (!query.initiatorRole || query.initiatorRole === item.initiatorRole)
        && (!query.initiatorProviderId || String(query.initiatorProviderId) === String(item.initiatorProviderId))
      ).length),
    } },
    './systemConfig.service': { getBookingPolicy: async () => ({
      minAdvanceMinutes: 240, rescheduleResponseMinutes: 30,
      providerMonthlyRescheduleWarningThreshold: 3,
    }) },
  };
  vm.runInNewContext(code, {
    exports, Date, Map, Set, require: name => modules[name] ?? {},
  }, { filename });
  return exports;
}

test('Khách bị từ chối mất lượt trên đơn; phía provider vẫn còn lượt riêng', async () => {
  const service = setup([{ status: 'rejected', initiatorRole: 'customer' }]);
  const current = order(true, 'accepted');
  const customer = await service.getOrderRescheduleContext(current, { id: String(customerId), role: 'CUSTOMER' });
  assert.equal(customer.rescheduleEligibility.canRequest, false);
  assert.equal(customer.rescheduleEligibility.remainingCount, 0);
  const provider = await service.getOrderRescheduleContext(current, { id: String(providerUserId), role: 'PROVIDER' });
  assert.equal(provider.rescheduleEligibility.canRequest, true);
});

test('Provider bị từ chối mất lượt trên đơn nhưng không tăng bộ đếm tháng', async () => {
  const service = setup([{ status: 'rejected', initiatorRole: 'provider', initiatorProviderId: providerId }]);
  const result = await service.getOrderRescheduleContext(order(true, 'accepted'), { id: String(providerUserId), role: 'PROVIDER' });
  assert.equal(result.rescheduleEligibility.providerMonthlyAppliedCount, 0);
  assert.equal(result.rescheduleEligibility.remainingCount, 0);
});

test('Bộ đếm tháng chỉ lấy hai lần thành công, bỏ qua các lần bị từ chối', async () => {
  const history = ['applied', 'rejected', 'applied', 'rejected'].map(status => ({
    status, initiatorRole: 'provider', initiatorProviderId: providerId,
  }));
  const result = await setup(history).getOrderRescheduleContext(order(true, 'accepted'), {
    id: String(providerUserId), role: 'PROVIDER',
  });
  assert.equal(result.rescheduleEligibility.providerMonthlyAppliedCount, 2);
});

function order(populated, status = 'created') {
  return {
    _id: new Types.ObjectId(),
    customerId: populated ? { _id: customerId, fullName: 'Khách kiểm thử' } : customerId,
    providerId: status === 'accepted'
      ? populated ? { _id: providerId, userId: { _id: providerUserId } } : providerId
      : null,
    orderType: 'scheduled', status,
    scheduledAt: new Date(Date.now() + 86400000),
  };
}

for (const populated of [false, true]) {
  test(`Chủ đơn đọc điều kiện dời lịch tại bước thanh toán, populate=${populated}`, async () => {
    const result = await setup().getOrderRescheduleContext(order(populated), {
      id: String(customerId), role: 'CUSTOMER',
    });
    assert.equal(result.rescheduleEligibility.canRequest, true);
    assert.equal(result.rescheduleEligibility.remainingCount, 1);
  });

  test(`Chuyên gia phụ trách đọc điều kiện dời lịch, populate=${populated}`, async () => {
    const result = await setup().getOrderRescheduleContext(order(populated, 'accepted'), {
      id: String(providerUserId), role: 'PROVIDER',
    });
    assert.equal(result.rescheduleEligibility.canRequest, true);
  });

  test(`Vẫn chặn người ngoài đơn, populate=${populated}`, async () => {
    const service = setup();
    await assert.rejects(service.getOrderRescheduleContext(order(populated), {
      id: String(new Types.ObjectId()), role: 'CUSTOMER',
    }), error => error.statusCode === 403);
    await assert.rejects(service.getOrderRescheduleContext(order(populated, 'accepted'), {
      id: String(new Types.ObjectId()), role: 'PROVIDER',
    }), error => error.statusCode === 403);
  });
}
