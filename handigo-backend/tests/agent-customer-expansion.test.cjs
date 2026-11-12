const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Chạy module thật với dữ liệu giả; không gọi AI, PayOS hoặc database thật.
const root = path.resolve(__dirname, '../src');
function loader(mocks = {}, globals = {}) {
  const cache = new Map();
  function load(relative) {
    const filename = path.resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename);
    const exports = {}; cache.set(filename, exports);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(source, { exports, Date, Map, Set, Buffer, URL, AbortSignal, console, JSON, structuredClone, setTimeout, clearTimeout,
      process: { env: {} }, ...globals,
      require(name) {
        const match = Object.keys(mocks).find(key => name.endsWith(key));
        if (match) return mocks[match];
        if (!name.startsWith('.')) return require(name);
        return load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`)));
      },
    }, { filename });
    return exports;
  }
  return load;
}
const user = { id: '111111111111111111111111', role: 'CUSTOMER' };
const orderId = '222222222222222222222222';
const requestId = '333333333333333333333333';
const signal = () => new AbortController().signal;

test('Ước tính dùng tuyến đường thật; GPS cũ, thiếu, sai tương lai không gọi định tuyến', async () => {
  let provider = { latitude: 16, longitude: 108, updatedAt: new Date() };
  let calls = 0;
  const order = { orderCode: 'ORD-1', status: 'accepted', providerId: 'provider' };
  const load = loader({
    '/order.model': { Order: { findOne(filter) { assert.equal(filter.customerId, user.id); return { select: () => ({ lean: async () => order }) }; } } },
    '/orderTracking.service': { getOrderTrackingState: async () => ({ provider, customer: { latitude: 16.1, longitude: 108 } }) },
    '/routing.service': { getDrivingRoute: async () => { calls++; return { distanceMeters: 2200, durationSeconds: 301 }; } },
    '/timeout': { withAgentTimeout: p => p },
  });
  const get = load('services/agentArrivalEstimate.service.ts').getAgentArrivalEstimate;
  const result = await get(user.id, orderId, signal());
  assert.equal(result.status, 'estimated'); assert.equal(result.durationSeconds, 301);
  assert.match(result.message, /6 phút/); assert.equal(calls, 1);
  for (const location of [null, { updatedAt: new Date(Date.now() - 61000) }, { updatedAt: new Date(Date.now() + 10000) }]) {
    provider = location;
    assert.equal((await get(user.id, orderId, signal())).status, 'stale');
  }
  assert.equal(calls, 1);
});

test('Không ước tính cho đơn người khác, thợ đã tới hoặc thay đổi phân công khi tải tuyến', async () => {
  let order = null;
  let calls = 0;
  const load = loader({
    '/order.model': { Order: { findOne: () => ({ select: () => ({ lean: async () => order }) }) } },
    '/orderTracking.service': { getOrderTrackingState: async () => ({ provider: { updatedAt: new Date() }, customer: {} }) },
    '/routing.service': { getDrivingRoute: async () => { calls++; order = { ...order, providerId: 'new' }; return { distanceMeters: 500, durationSeconds: 60 }; } },
    '/timeout': { withAgentTimeout: p => p },
  });
  const get = load('services/agentArrivalEstimate.service.ts').getAgentArrivalEstimate;
  await assert.rejects(get(user.id, orderId, signal()), /Không tìm thấy/);
  order = { status: 'accepted', providerId: 'p', arrival: { providerId: 'p' } };
  assert.equal((await get(user.id, orderId, signal())).status, 'arrived'); assert.equal(calls, 0);
  order = { status: 'accepted', providerId: 'p' };
  assert.equal((await get(user.id, orderId, signal())).status, 'unavailable');
});

function accountFixture() {
  let balance = 100;
  let terms = 'v1';
  let found = null;
  const created = [];
  const synced = [];
  const voucher = { code: 'MY-VOUCHER', name: 'Ưu đãi', discountType: 'AMOUNT', discountValue: 10000 };
  const load = loader({
    '/walletTransaction.model': { WalletTransaction: { findOne: async query => { if (found) assert.equal(query.userId, user.id); return found; } } },
    '/reward.model': { RewardTransaction: { findById: key => { assert.equal(key, `redeem:${user.id}:action`); return { lean: async () => found }; } } },
    '/voucherStore.service': { findStoredVoucher: async query => { assert.equal(query.ownerId, user.id); return voucher; } },
    '/reward.service': {
      getRewardOverview: async () => ({ balance, policy: { validityDays: 30, offers: [{ id: 'offer', name: 'Ưu đãi', points: 50, termsVersion: terms, discountValue: 10000, minOrderAmount: 50000 }] } }),
      redeemReward: async (...args) => { created.push(args); return voucher; },
    },
    '/wallet.service': {
      createWalletDeposit: async (actor, args, id) => {
        created.push({ actor, args, id: String(id) });
        return { transaction: { _id: id, amount: args.amount, status: 'pending', gatewayOrderCode: '123', gatewayResponse: { secret: 'hidden', paymentLink: { checkoutUrl: 'https://pay.example/123' } } } };
      },
      syncWalletDeposit: async (...args) => { synced.push(args); return found; },
    },
  });
  return { service: load('services/agentCustomerAccount.service.ts').AgentCustomerAccountService, load,
    created, synced, setBalance: v => balance = v, setTerms: v => terms = v, setFound: v => found = v };
}

test('Đổi điểm chốt điều kiện hiện tại, không đủ điểm thì dừng, khôi phục chỉ đọc giao dịch đúng hành động', async () => {
  const f = accountFixture();
  const preview = await f.service.previewReward(user.id, 'offer');
  assert.equal(preview.points, 50); assert.equal(preview.termsVersion, 'v1');
  f.setTerms('v2');
  assert.notEqual((await f.service.previewReward(user.id, 'offer')).termsVersion, preview.termsVersion);
  f.setBalance(1); await assert.rejects(f.service.previewReward(user.id, 'offer'), /chưa đủ điểm/);
  await f.service.redeem(user, 'offer', preview, 'action');
  assert.equal(f.created[0][2], 'action'); assert.equal(f.created[0][3], 'v1');
  assert.equal(await f.service.reconcileReward(user, 'offer', 'action'), null);
  f.setFound({ offerId: 'other' }); assert.equal(await f.service.reconcileReward(user, 'offer', 'action'), null);
  f.setFound({ offerId: 'offer', voucherId: 'voucher' });
  assert.equal((await f.service.reconcileReward(user, 'offer', 'action')).voucherCode, 'MY-VOUCHER');
  assert.equal(f.created.length, 1);
});

test('Nạp ví ràng buộc mã hành động, không lộ gateway thô, không tạo lại khi kết quả chưa rõ', async () => {
  const f = accountFixture();
  await assert.rejects(f.service.createDeposit(user, 50000), /Thiếu mã/);
  await assert.rejects(f.service.createDeposit({ ...user, role: 'PROVIDER' }, 50000, 'action'), /Chỉ khách hàng/);
  const result = await f.service.createDeposit(user, 50000, 'action');
  assert.equal(result.status, 'pending'); assert.equal(result.checkoutUrl, 'https://pay.example/123');
  assert.ok(!JSON.stringify(result).includes('hidden'));
  assert.equal(await f.service.reconcileDeposit(user, 50000, 'action'), null);
  f.setFound({ _id: f.created[0].id, gatewayOrderCode: '123', amount: 50000, status: 'pending' });
  assert.equal(await f.service.reconcileDeposit(user, 50000, 'action'), null);
  assert.equal(f.created.length, 1); assert.equal(f.synced.length, 1);
  f.setFound({ status: 'success', amount: 50000, _id: 'tx', gatewayOrderCode: '123' });
  assert.equal((await f.service.reconcileDeposit(user, 50000, 'action')).checkoutUrl, null);
});

test('Bản xác nhận đổi điểm mất hiệu lực khi điều kiện thay đổi', async () => {
  const f = accountFixture();
  const { ConfirmationService } = f.load('ai/agent/confirmation.service.ts');
  const tool = { name: 'redeem_reward', inputSchema: require('zod').z.object({ offerId: require('zod').z.string() }),
    preview: (_ctx, args) => f.service.previewReward(user.id, args.offerId) };
  const confirm = new ConfirmationService();
  const ctx = { user, signal: signal() };
  const action = await confirm.prepare(tool, ctx, { offerId: 'offer' });
  assert.equal(await confirm.unchanged(tool, ctx, action), true);
  f.setTerms('v2'); assert.equal(await confirm.unchanged(tool, ctx, action), false);
});

test('Dời lịch kiểm tra chủ đơn, chốt phiên bản và gửi ID cố định để đối soát', async () => {
  let owned = true;
  let request = null;
  const ids = [];
  const load = loader({
    '/order.model': { Order: { findOne: async query => { assert.equal(query.customerId, user.id); return owned ? { updatedAt: new Date('2026-10-01'), orderCode: 'ORD-1' } : null; } } },
    '/orderRescheduleRequest.model': { OrderRescheduleRequest: { findOne: async () => request } },
    '/orderReschedule.service': {
      previewOrderReschedule: async () => ({ approvalRequired: true, currentScheduledAt: new Date('2026-11-01'), proposedScheduledAt: new Date('2026-11-02') }),
      createOrderRescheduleRequest: async (_id, _user, args, id) => { ids.push(String(id)); assert.equal(args.expectedOrderUpdatedAt, '2026-10-01T00:00:00.000Z'); return { _id: id, orderId, status: 'pending' }; },
    },
  });
  const service = load('services/agentReschedule.service.ts').AgentRescheduleService;
  const args = { orderId, scheduledAt: '2026-11-02T10:00:00+07:00', reason: 'Tôi bận' };
  owned = false; await assert.rejects(service.previewCreate(user, args), /Không tìm thấy/);
  owned = true; const preview = await service.previewCreate(user, args);
  assert.match(preview.note, /thợ đồng ý/);
  assert.equal((await service.create(user, args, preview, 'action')).status, 'pending');
  await service.create(user, args, preview, 'action'); assert.equal(ids[0], ids[1]);
  request = { _id: requestId, orderId, status: 'pending', initiatorId: user.id, approvalRole: 'provider', expiresAt: new Date(Date.now() + 60000) };
  await assert.rejects(service.previewResponse(user, { orderId, requestId, decision: 'accept' }), /không có quyền/);
  request.expiresAt = new Date(0);
  await assert.rejects(service.previewResponse(user, { orderId, requestId }, true), /không còn chờ/);
});

test('Ảnh chỉ tải từ thư mục upload, chặn URL ngoài, MIME/chữ ký sai và vượt dung lượng', async () => {
  const url = 'https://res.cloudinary.com/demo/image/upload/v123/handigo/order-attachments/img.png';
  let response;
  const load = loader({ '/ai.config': { DEFAULT_GEMINI_AGENT_MODEL: 'test' }, '@google/generative-ai': {} }, {
    fetch: async (_url, options) => { assert.equal(options.redirect, 'error'); return response; },
  });
  const { assertRepairImageUrl, readRepairImage } = load('services/repairImageAnalysis.service.ts');
  assert.equal(assertRepairImageUrl(url), url);
  for (const bad of ['http://127.0.0.1/x', 'https://example.com/x', url + '?redirect=x', url.replace('order-attachments', 'other'), url.replace('res.cloudinary.com', 'res.cloudinary.com.evil.com')]) {
    assert.throws(() => assertRepairImageUrl(bad));
  }
  const makeResponse = (mime, bytes, length) => ({ ok: true, headers: { get: name => name === 'content-type' ? mime : length ?? null }, body: { getReader: () => {
    let done = false; return { read: async () => done ? { done: true } : (done = true, { done: false, value: bytes }), cancel: async () => {} };
  } } });
  response = makeResponse('text/html', Buffer.from('x'));
  await assert.rejects(readRepairImage(url, signal()), /Không đọc/);
  response = makeResponse('image/png', Buffer.from('not-png'));
  await assert.rejects(readRepairImage(url, signal()), /không hợp lệ/);
  response = makeResponse('image/png', Buffer.alloc(1), String(6 * 1024 * 1024));
  await assert.rejects(readRepairImage(url, signal()), /5 MB/);
  response = makeResponse('image/png', Buffer.from([137,80,78,71,13,10,26,10]));
  assert.equal((await readRepairImage(url, signal())).inlineData.mimeType, 'image/png');
});

test('Tư vấn ảnh ưu tiên an toàn, chặn ảnh khác phiên, đọc kiến thức mới thay vì đoán lỗi', async () => {
  let reads = 0; let adviceReads = 0; let readable = true;
  const load = loader({
    '/repairImageAnalysis.service': { analyzeRepairImages: async () => { reads++; return { relevant: true, readable, device: 'Máy lạnh', observations: ['Màn hình hiển thị E1'], errorCodes: ['E1'], visibleHazards: [], questions: [] }; } },
    '/get-repair-advice.tool': { getRepairAdviceTool: { execute: async (_ctx, args) => { adviceReads++; assert.match(args.description, /E1/); return { articles: [{ title: 'Bài mới' }] }; } } },
  });
  const tool = load('ai/tools/implementations/analyze-repair-images.tool.ts').analyzeRepairImagesTool;
  const ctx = { user, signal: signal(), session: { uploadedAttachments: ['https://owned/image'], conversation: [{ role: 'user', customerAttachments: ['https://owned/image'] }] } };
  assert.equal((await tool.execute(ctx, { description: 'Tivi có khói' })).status, 'urgent'); assert.equal(reads, 0);
  await assert.rejects(tool.execute(ctx, { description: '', customerAttachments: ['https://other/image'] }), /chưa được tải/);
  assert.equal((await tool.execute(ctx, { description: 'Máy lạnh báo lỗi' })).advice.articles[0].title, 'Bài mới');
  readable = false; assert.equal((await tool.execute(ctx, { description: '' })).status, 'needs_details');
  assert.equal(adviceReads, 1);
});

test('Nhóm công cụ và quyền ghi có xác nhận; API chấp nhận báo giá được gỡ', () => {
  const load = loader({ '/reward.service': {}, '/wallet.service': {}, '/agentCustomerAccount.service': {} });
  const groups = load('ai/tools/tool-groups.ts');
  assert.equal(groups.inferToolIntent('Tôi muốn đổi điểm'), 'booking');
  assert.equal(groups.inferToolIntent('Dời lịch đơn này'), 'order');
  assert.equal(groups.inferToolIntent('Xem số dư ví'), 'payment');
  assert.ok(groups.COMMON_TOOLS.includes('analyze_repair_images'));
  const { ToolRegistry } = load('ai/tools/tool-registry.ts');
  const account = load('ai/tools/implementations/customer-account.tools.ts');
  const registry = new ToolRegistry();
  for (const tool of [account.redeemRewardTool, account.createWalletDepositTool, account.cancelWalletDepositTool]) {
    registry.register(tool); assert.equal(registry.needsConfirmation(tool), true);
    assert.throws(() => registry.get(tool.name, { user: { ...user, role: 'PROVIDER' } }));
    assert.throws(() => registry.get(tool.name, { user, readOnly: true }));
  }
  for (const amount of [-1, 0, 1.5, Infinity]) assert.equal(account.createWalletDepositTool.inputSchema.safeParse({ amount }).success, false);
  for (const filename of ['services/assignment.service.ts', 'controllers/order.controller.ts', 'routes/order.routes.ts']) {
    assert.ok(!fs.readFileSync(path.join(root, filename), 'utf8').includes('confirmRepairQuotation'));
  }
  assert.ok(!fs.readFileSync(path.join(root, 'routes/order.routes.ts'), 'utf8').includes('/quotations/:quotationId/confirm'));
});

test('Sáu thao tác mới đi qua graph xác nhận và ledger, phát lại không ghi lần hai', async () => {
  const load = loader({ '/booking-draft': {}, '/agentPayment.service': {} });
  const { ToolRegistry } = load('ai/tools/tool-registry.ts');
  const { ConfirmationService } = load('ai/agent/confirmation.service.ts');
  const { newSession } = load('ai/agent/agent-state.ts');
  const { ActionGraphDispatcher } = load('ai/runtime/action-graph-dispatcher.ts');
  const z = require('zod').z;
  for (const name of ['request_booking_reschedule', 'respond_booking_reschedule', 'cancel_booking_reschedule', 'redeem_reward', 'create_wallet_deposit', 'cancel_wallet_deposit']) {
    let writes = 0; let record = null;
    const tool = { name, roles: ['CUSTOMER'], mutates: true, requiresConfirmation: true,
      inputSchema: z.object({}).strict(), preview: async () => ({ title: 'Xác nhận thao tác' }),
      execute: async ctx => { assert.ok(ctx.actionId); writes++; return { message: 'Đã thực hiện' }; } };
    const registry = new ToolRegistry().register(tool);
    const session = newSession('session', user.id);
    const ctx = { user, sessionId: session.id, session, signal: signal() };
    const action = await new ConfirmationService().prepare(tool, ctx, {});
    session.pendingAction = action;
    const ledger = {
      find: async () => record,
      reserve: async identity => { const inserted = !record; record ??= { ...identity, status: 'EXECUTING', active: true, startedAt: new Date().toISOString() }; return { record, inserted }; },
      settle: async (_identity, status, result) => (record = { ...record, status, result, active: false }),
    };
    const dispatcher = new ActionGraphDispatcher(registry, ledger, async () => {});
    await assert.rejects(dispatcher.run(session, ctx, action), /Chưa có xác nhận/);
    assert.equal(writes, 0);
    session.activeRequest = { input: { confirmation: { actionId: action.id, decision: 'CONFIRM' } } };
    const first = await dispatcher.run(session, ctx, action);
    assert.equal(first.action.status, 'SUCCEEDED', name);
    const replay = await dispatcher.run(first.session, { ...ctx, session: first.session }, first.action);
    assert.equal(replay.action.status, 'SUCCEEDED', name);
    assert.equal(writes, 1, name);
  }
});
