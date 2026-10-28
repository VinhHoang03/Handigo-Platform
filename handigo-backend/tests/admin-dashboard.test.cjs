const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relative, modules = {}) {
  const file = path.join(__dirname, '../src', relative);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Date, Map, Set, require(name) {
    if (name in modules) return modules[name];
    if (name === 'zod') return require('zod');
    throw Error(`Chưa khai báo phụ thuộc kiểm thử: ${name}`);
  } }, { filename: file });
  return exports;
}
const appError = load('utils/appError.ts');
const metrics = load('services/adminDashboardMetrics.ts', { '../utils/appError': appError });
const { adminDashboardQuerySchema: schema } = load('validations/adminDashboard.validator.ts');
const plain = value => JSON.parse(JSON.stringify(value));

test('Khoảng mặc định là 30 ngày theo giờ Việt Nam, kể cả khi ngày UTC khác ngày Việt Nam', () => {
  const period = metrics.getInsightsPeriod({}, new Date('2026-10-26T18:00:00Z'));
  assert.equal(period.fromDate.toISOString(), '2026-09-27T17:00:00.000Z');
  assert.equal(period.toDate.toISOString(), '2026-10-27T16:59:59.999Z');
  assert.equal(period.previousToDate.getTime() + 1, period.fromDate.getTime());
  assert.equal(period.toDate - period.fromDate, period.previousToDate - period.previousFromDate);
});

test('Khoảng một ngày và ngày nhuận bao gồm trọn ngày, kỳ trước không chồng kỳ hiện tại', () => {
  const parsed = schema.parse({ fromDate: '2024-02-29', toDate: '2024-02-29' });
  const period = metrics.getInsightsPeriod(parsed);
  assert.equal(period.fromDate.toISOString(), '2024-02-28T17:00:00.000Z');
  assert.equal(period.toDate.toISOString(), '2024-02-29T16:59:59.999Z');
  assert.equal(period.previousFromDate.toISOString(), '2024-02-27T17:00:00.000Z');
});

test('Từ chối ngày không tồn tại, định dạng sai, khoảng đảo ngược và ngày bắt đầu trong tương lai khi thiếu ngày kết thúc', () => {
  for (const query of [
    { fromDate: '2026-02-30' }, { toDate: '2026-13-01' }, { fromDate: '27/10/2026' },
    { fromDate: '2026-10-28', toDate: '2026-10-27' },
  ]) assert.equal(schema.safeParse(query).success, false);
  assert.throws(() => metrics.getInsightsPeriod(schema.parse({ fromDate: '2026-10-28' }), new Date('2026-10-27T03:00:00Z')),
    error => error.statusCode === 400);
});

test('Chỉ chọn ngày kết thúc vẫn tạo đủ 30 ngày; thay đổi phần trăm không chia cho 0', () => {
  const period = metrics.getInsightsPeriod(schema.parse({ toDate: '2026-10-01' }));
  assert.equal(period.toDate.getTime() - period.fromDate.getTime() + 1, 30 * 86400000);
  assert.equal(metrics.compareMetric(10, 0).changePercent, null);
  assert.equal(metrics.compareMetric(0, 0).changePercent, null);
  assert.equal(metrics.compareMetric(0, 10).changePercent, -100);
  assert.equal(metrics.compareMetric(15, 10).changePercent, 50);
});

function serviceContext(overrides = {}) {
  const emptyModel = { countDocuments: async () => 0, aggregate: async () => [] };
  const names = ['order', 'payment', 'walletTransaction', 'providerApplication', 'supportTicket', 'complaint', 'feedback', 'serviceSuggestion', 'withdrawRequest'];
  const modelNames = ['Order', 'Payment', 'WalletTransaction', 'ProviderApplication', 'SupportTicket', 'Complaint', 'Feedback', 'ServiceSuggestion', 'WithdrawRequest'];
  const modules = {
    '../models/user.model': { __esModule: true, default: overrides.User ?? emptyModel },
    '../sockets/socketServer': { getOnlineUserIds: overrides.getOnlineUserIds ?? (async () => []) },
    './adminDashboardMetrics': metrics,
  };
  names.forEach((name, index) => { modules[`../models/${name}.model`] = { [modelNames[index]]: overrides[modelNames[index]] ?? emptyModel }; });
  return load('services/adminDashboard.service.ts', modules);
}

test('Nhiều tab chỉ tính một tài khoản online; loại phòng không phải tài khoản', async () => {
  const socketService = load('sockets/socketServer.ts', {
    '../models/conversation.model': {}, '../models/order.model': {}, '../models/provider.model': {},
    '../utils/logger': { createLogger: () => ({ error() {} }) },
  });
  assert.equal(await socketService.getOnlineUserIds(), null);
  const a = '000000000000000000000001', b = '000000000000000000000002';
  socketService.setSocketServer({ fetchSockets: async () => [
    { rooms: new Set([`user:${a}`, 'conversation:abc', 'socket:one']) },
    { rooms: new Set([`user:${a}`, `user:${b}`, 'user:invalid']) },
  ] });
  assert.deepEqual(plain(await socketService.getOnlineUserIds()), [a, b]);
});

test('Online không bao gồm tài khoản khóa/xóa; tổng đăng ký bao gồm các tài khoản còn lưu', async () => {
  const roster = [
    { id: 'a', isDeleted: false, status: 'active' }, { id: 'b', isDeleted: false, status: 'locked' },
    { id: 'c', isDeleted: true, status: 'active' }, { id: 'd', isDeleted: false, status: 'active' },
  ];
  const service = serviceContext({
    getOnlineUserIds: async () => ['a', 'b', 'c'],
    User: { countDocuments: async filter => roster.filter(user => !user.isDeleted &&
      (!filter.status || user.status === filter.status) && (!filter._id || filter._id.$in.includes(user.id))).length },
  });
  const result = await service.getAdminUserPresence();
  assert.equal(result.totalRegisteredUsers, 3);
  assert.equal(result.onlineUsers, 1);
  const unknown = await serviceContext({ getOnlineUserIds: async () => null }).getAdminUserPresence();
  assert.equal(unknown.onlineUsers, null);
});

test('Dashboard rỗng trả các số 0 hữu hạn và các danh sách rỗng', async () => {
  const data = await serviceContext().getAdminInsights(schema.parse({ fromDate: '2026-10-01', toDate: '2026-10-27' }));
  assert.equal(data.pendingWork.applications, 0);
  assert.equal(data.attentionOrders.items.length, 0);
  assert.equal(data.deposits.heldAmount, 0);
  assert.equal(data.deposits.pendingRefundAmount, 0);
  assert.equal(data.quality.providers.length, 0);
  assert.equal(data.comparison.orders.changePercent, null);
});

test('So sánh số đơn và tỷ lệ hủy dùng cùng nhóm đơn, không nhầm phần trăm với điểm phần trăm', async () => {
  const service = serviceContext({
    Order: { aggregate: async pipeline => pipeline.some(stage => stage.$facet) ? [] : pipeline.some(stage => stage.$group?.count)
      ? [{ _id: 'current', count: 10, cancelled: 2 }, { _id: 'previous', count: 8, cancelled: 2 }] : [] },
    WalletTransaction: { aggregate: async () => [{ _id: 'current', amount: 100 }, { _id: 'previous', amount: 50 }] },
  });
  const data = await service.getAdminInsights(schema.parse({ fromDate: '2026-10-01', toDate: '2026-10-27' }));
  assert.equal(data.comparison.orders.changePercent, 25);
  assert.equal(data.comparison.platformRevenue.changePercent, 100);
  assert.equal(data.comparison.cancellationRate.changePoints, -5);
});

test('Cọc hoàn một phần và bồi thường dùng đúng khoản đã phân bổ, không cộng nguyên cọc hai lần', async () => {
  let stages;
  await serviceContext({ Payment: { aggregate: async pipeline => { stages = pipeline; return []; } } })
    .getAdminInsights(schema.parse({ fromDate: '2026-10-01', toDate: '2026-10-27' }));
  // Đánh giá các biểu thức tiền của pipeline trên chứng từ giả lập, không truy cập database.
  function value(expression, document) {
    if (typeof expression === 'string' && expression.startsWith('$')) return expression.slice(1).split('.').reduce((item, key) => item?.[key], document);
    if (Array.isArray(expression)) return expression.map(item => value(item, document));
    if (!expression || typeof expression !== 'object' || expression instanceof Date) return expression;
    const [operator, operands] = Object.entries(expression)[0];
    if (operator === '$cond') return value(operands[value(operands[0], document) ? 1 : 2], document);
    const args = value(operands, document);
    switch (operator) {
      case '$ifNull': return args[0] ?? args[1];
      case '$and': return args.every(Boolean);
      case '$eq': return args[0] === args[1];
      case '$ne': return args[0] !== args[1];
      case '$gte': return args[0] >= args[1];
      case '$lte': return args[0] <= args[1];
      case '$in': return args[1].includes(args[0]);
      default: throw Error(`Biểu thức chưa hỗ trợ: ${operator}`);
    }
  }
  const group = stages.find(stage => stage.$group).$group;
  const held = stages.find(stage => stage.$set).$set.isHeld;
  const document = {
    amount: 100000, status: 'refunded', refundedAt: new Date('2026-10-10T00:00:00Z'),
    compensatedAt: new Date('2026-10-11T00:00:00Z'), compensatedToProviderId: 'provider',
    order: { status: 'cancelled' }, metadata: { refund: { amount: 30000 }, cancellationCompensation: { amount: 70000 } },
  };
  assert.equal(value(group.refundedAmount.$sum, document), 30000);
  assert.equal(value(group.compensatedAmount.$sum, document), 70000);
  assert.equal(value(held, document), false);
  document.metadata.refund.amount = 0;
  assert.equal(value(group.refundedAmount.$sum, document), 0);
  document.refundedAt = new Date('2026-09-20T00:00:00Z');
  document.metadata.refund.amount = 30000;
  assert.equal(value(group.refundedAmount.$sum, document), 0);
  assert.equal(value(held, { amount: 100000, status: 'paid', order: { status: 'accepted' } }), true);
  assert.equal(value(held, { amount: 100000, status: 'paid', order: { status: 'completed' } }), false);
});

test('Hai API mới luôn đi qua xác thực và phân quyền ADMIN', () => {
  const routes = [], common = [];
  const noop = () => {};
  const { roleMiddleware } = load('middlewares/role.middleware.ts');
  const authMiddleware = noop;
  load('routes/dashboard.routes.ts', {
    express: { Router: () => ({ use: handler => common.push(handler), get: (route, ...handlers) => routes.push({ route, handlers }), patch: noop }) },
    '../controllers/dashboard.controller': new Proxy({}, { get: () => noop }),
    '../middlewares/auth.middleware': { authMiddleware },
    '../middlewares/role.middleware': { roleMiddleware },
    '../middlewares/rateLimit.middleware': { resourceIntensiveRateLimit: noop },
    '../middlewares/approvedProvider.middleware': { approvedProviderMiddleware: noop },
  });
  assert.equal(common[0], authMiddleware);
  for (const route of ['/insights', '/presence']) {
    const guard = routes.find(item => item.route === route).handlers[0];
    for (const role of ['CUSTOMER', 'PROVIDER', undefined, 'ADMIN']) {
      let allowed = false, status;
      const res = { status(value) { status = value; return this; }, json() {} };
      guard({ user: role ? { role } : undefined, query: { role: 'ADMIN' }, body: { role: 'ADMIN' } }, res, () => { allowed = true; });
      assert.equal(allowed, role === 'ADMIN');
      if (!allowed) assert.equal(status, 403);
    }
  }
});
