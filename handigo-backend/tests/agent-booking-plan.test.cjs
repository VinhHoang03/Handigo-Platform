const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { z } = require('zod');
const { randomUUID } = require('node:crypto');
const { newSession } = require('../dist/ai/agent/agent-state');
const { manageBookingPlan, recordPlannedBooking, bookingPlanView, bookingPlanSchema } = require('../dist/ai/agent/booking-plan');
const user = { id: '111111111111111111111111', role: 'CUSTOMER' };
const serviceId = '222222222222222222222222', addressId = '333333333333333333333333';
const items = () => [
  { label: 'Vệ sinh máy lạnh', request: 'Vệ sinh máy lạnh ở nhà vào ngày đã chọn', seed: { serviceId, addressId, quantity: 2, recipientName: 'Nguyễn An', recipientPhone: '0912345678', orderType: 'scheduled', scheduledAt: '2030-10-04T09:00:00+07:00', paymentMethod: 'cash' } },
  { label: 'Sửa ống nước', request: 'Sửa ống nước tại địa chỉ khác, chọn lại lịch hẹn' },
];
function fixture() {
  const session = newSession(randomUUID(), user.id);
  session.activeRequest = { requestId: randomUUID(), digest: 'thử nghiệm', input: { message: 'Đặt hai dịch vụ', requestId: randomUUID() } };
  const context = { user, session, sessionId: session.id, signal: new AbortController().signal };
  const create = () => manageBookingPlan(context, { action: 'create', items: items() });
  const action = (action, extra = {}) => manageBookingPlan(context, { action, planId: session.bookingPlan.id, revision: session.bookingPlan.revision, ...extra });
  return { session, context, create, action };
}
function completed(session, overrides = {}) {
  return { tool: 'create_booking', status: 'SUCCEEDED', preview: { bookingPlanId: session.bookingPlan.id, bookingPlanItemId: session.bookingPlan.activeItemId },
    result: { orderId: '444444444444444444444444', orderCode: 'ORD-THU-NGHIEM' }, ...overrides };
}

test('Danh sách chỉ nhận 2–10 việc và dữ liệu hợp lệ, không nhận quyền/danh tính hoặc chế độ tạo lại trong seed', () => {
  assert.equal(bookingPlanSchema.safeParse({ action: 'create', items: items() }).success, true);
  for (const input of [{ action: 'create', items: [] }, { action: 'create', items: [items()[0]] },
    { action: 'create', items: Array(11).fill(items()[0]) }, { action: 'create', items: items(), userId: user.id },
    { action: 'create', items: [{ ...items()[0], seed: { startNew: true } }, items()[1]] },
    { action: 'create', items: [{ ...items()[0], seed: { recipientName: '123' } }, items()[1]] }]) {
    assert.equal(bookingPlanSchema.safeParse(input).success, false);
  }
});

test('Chỉ CUSTOMER đúng phiên được tạo danh sách; chế độ chỉ đọc không thay đổi tiến độ', () => {
  for (const change of [{ user: { ...user, role: 'ADMIN' } }, { user: { ...user, role: 'PROVIDER' } },
    { user: { ...user, id: addressId } }, { sessionId: randomUUID() }, { readOnly: true }]) {
    const f = fixture(); assert.throws(() => manageBookingPlan({ ...f.context, ...change }, { action: 'create', items: items() }));
    assert.equal(f.session.bookingPlan, undefined);
  }
});

test('Tạo danh sách chưa tạo đơn; phát lại cùng request không nhân bản mục, không đè bản nháp hiện có', () => {
  const f = fixture(); const view = f.create();
  assert.equal(view.items.length, 2); assert.equal(view.items[0].status, 'active');
  assert.deepEqual(f.session.bookingDraft.values, {});
  assert.equal(f.create().id, view.id);
  f.session.activeRequest.requestId = randomUUID(); assert.throws(f.create, /chưa hoàn tất/);
  const other = fixture(); other.session.bookingDraft = { status: 'active' }; assert.throws(other.create, /bản nháp/);
});

test('Ảnh sai phiên bị chặn trước khi tạo, thêm hoặc sửa; ảnh chưa được phân công không tự chia cho các đơn', () => {
  const f = fixture(), image = 'https://res.cloudinary.com/demo/image/upload/hien-trang.jpg';
  const list = items(); list[0].seed.customerAttachments = [image];
  assert.throws(() => manageBookingPlan(f.context, { action: 'create', items: list }), /chưa được tải/);
  f.session.uploadedAttachments = [image]; manageBookingPlan(f.context, { action: 'create', items: list });
  assert.deepEqual(f.session.bookingPlan.items[0].seed.customerAttachments, [image]);
  assert.equal(f.session.bookingPlan.items[1].seed, undefined);
  assert.throws(() => f.action('append', { items: [{ ...items()[1], seed: { customerAttachments: ['https://khac.test/anh.jpg'] } }] }), /chưa được tải/);
});

test('Thêm việc khi đang soạn một đơn có thể giữ bản nháp làm mục đầu, không thay dữ liệu hoặc mất địa chỉ tạm', () => {
  const f = fixture();
  f.session.bookingDraft = { revision: 12, status: 'paused', values: { recipientName: 'Nguyễn An' }, draftAddress: { fullAddress: 'Địa chỉ tạm' }, sources: {}, missing: [], summary: [], choiceGroups: [] };
  const list = items(); delete list[0].seed;
  manageBookingPlan(f.context, { action: 'create', items: list, includeCurrentDraft: true });
  assert.equal(f.session.bookingDraft.values.recipientName, 'Nguyễn An');
  assert.equal(f.session.bookingDraft.draftAddress.fullAddress, 'Địa chỉ tạm');
  assert.ok(f.session.bookingDraft.revision > 12); assert.equal(f.session.bookingPlan.items[0].seedApplied, true);
  const invalid = fixture();
  assert.throws(() => manageBookingPlan(invalid.context, { action: 'create', items: list, includeCurrentDraft: true }), /Không còn bản nháp/);
  assert.equal(bookingPlanSchema.safeParse({ action: 'create', items: items(), includeCurrentDraft: true }).success, false);
});

test('Không chuyển mục khi chưa đặt; chỉ ghi nhận đúng kết quả thành công và đúng danh sách', () => {
  const f = fixture(); f.create();
  assert.throws(() => f.action('next'), /yêu cầu hiện tại/);
  for (const action of [completed(f.session, { status: 'UNKNOWN' }), completed(f.session, { tool: 'create_payment' }), completed(f.session, { preview: {} }),
    completed(f.session, { preview: { bookingPlanId: randomUUID(), bookingPlanItemId: f.session.bookingPlan.activeItemId } })]) recordPlannedBooking(f.session, action);
  assert.equal(f.session.bookingPlan.items[0].status, 'active');
  const action = completed(f.session); recordPlannedBooking(f.session, action);
  const revision = f.session.bookingPlan.revision; recordPlannedBooking(f.session, action);
  assert.equal(f.session.bookingPlan.revision, revision);
  assert.equal(f.session.bookingPlan.items[0].orderCode, 'ORD-THU-NGHIEM');
});

test('Chuyển sang việc kế tiếp không kế thừa thông tin riêng; phiên bản bản nháp tăng để chặn form cũ', () => {
  const f = fixture(); f.create();
  f.session.bookingDraft.values = { recipientName: 'Nguyễn An', recipientPhone: '0912345678', customerAttachments: ['ảnh'], voucherCode: 'MA-CU' };
  f.session.bookingDraft.revision = 42;
  recordPlannedBooking(f.session, completed(f.session)); f.action('next');
  assert.deepEqual(f.session.bookingDraft.values, {});
  assert.ok(f.session.bookingDraft.revision > 42);
  assert.equal(f.session.bookingPlan.items[0].status, 'created'); assert.equal(f.session.bookingPlan.items[1].status, 'active');
});

test('Tạm để lại giữ bản nháp, tiếp tục phục hồi đúng mục; bỏ mục cuối thì danh sách còn việc để lại sẽ tạm dừng', () => {
  const f = fixture(); f.create(); const first = f.session.bookingPlan.activeItemId;
  f.session.bookingDraft.values.recipientName = 'Trần Bình'; f.session.bookingDraft.revision = 15;
  f.action('defer'); assert.equal(f.session.bookingPlan.items[0].status, 'blocked');
  assert.throws(() => f.action('resume', { itemId: first }), /đang soạn/);
  f.action('skip'); assert.equal(f.session.bookingPlan.status, 'paused'); assert.equal(f.session.bookingDraft, undefined);
  f.action('resume', { itemId: first });
  assert.equal(f.session.bookingDraft.values.recipientName, 'Trần Bình'); assert.ok(f.session.bookingDraft.revision > 15);
  f.action('pause'); assert.equal(f.session.bookingDraft.status, 'paused');
  f.action('resume'); assert.equal(f.session.bookingDraft.status, 'active');
});

test('Bỏ danh sách không hủy đơn đã tạo; bỏ hết hoặc hoàn tất thì không cho sửa danh sách cũ', () => {
  for (const mode of ['cancel', 'skip', 'created']) {
    const f = fixture(); f.create(); recordPlannedBooking(f.session, completed(f.session));
    if (mode === 'cancel') f.action('cancel');
    else { f.action('next'); if (mode === 'skip') f.action('skip'); else recordPlannedBooking(f.session, completed(f.session)); }
    assert.equal(f.session.bookingPlan.items[0].orderCode, 'ORD-THU-NGHIEM');
    assert.equal(f.session.bookingPlan.status, mode === 'cancel' ? 'cancelled' : 'completed');
    assert.throws(() => f.action('append', { items: [items()[0]] }), /đã kết thúc/);
  }
});

test('Bỏ mục lúc tạm dừng không tự mở mục tiếp theo; không giữ nút thử lại của mục đã bỏ', () => {
  const f = fixture(); f.create(); f.action('pause');
  f.session.recovery = { tool: 'update_booking_draft' };
  f.action('skip');
  assert.equal(f.session.bookingPlan.status, 'paused'); assert.equal(f.session.bookingDraft, undefined);
  assert.equal(f.session.recovery, undefined); assert.equal(f.session.bookingPlan.items[1].status, 'queued');
  assert.throws(() => f.action('resume', { itemId: randomUUID() }), /Không tìm thấy yêu cầu/);
  assert.throws(() => f.action('resume', { itemId: f.session.bookingPlan.items[0].id }), /đã bỏ/);
  f.action('resume'); assert.equal(f.session.bookingPlan.items[1].status, 'active');
});

test('Xác nhận đang chờ hoặc kết quả tạo đơn/thanh toán chưa rõ chặn mọi đổi tiến độ; view vẫn đọc được', () => {
  for (const change of [{ pendingAction: { status: 'WAITING_CONFIRMATION' } }, { requiresReconciliation: true },
    { actions: [{ status: 'UNKNOWN', tool: 'create_booking' }] }, { actions: [{ status: 'EXECUTING', tool: 'create_payment' }] }]) {
    const f = fixture(); f.create(); Object.assign(f.session, change);
    for (const action of ['next', 'skip', 'defer', 'pause', 'resume', 'cancel']) assert.throws(() => f.action(action), /đối soát/);
    assert.equal(manageBookingPlan(f.context, { action: 'view' }).items.length, 2);
  }
});

test('Chặn phiên bản cũ, sửa mục đã tạo/đang soạn và quá giới hạn; chỉ sửa mục chưa bắt đầu', () => {
  const f = fixture(); const view = f.create();
  assert.throws(() => manageBookingPlan(f.context, { action: 'pause', planId: view.id, revision: 0 }), /đã thay đổi/);
  assert.throws(() => f.action('edit', { itemId: view.items[0].id, ...items()[0] }), /Chỉ sửa/);
  f.action('edit', { itemId: view.items[1].id, label: 'Sửa vòi bếp', request: 'Sửa vòi nước ở bếp vào buổi chiều' });
  assert.equal(f.session.bookingPlan.items[1].label, 'Sửa vòi bếp');
  assert.throws(() => f.action('append', { items: Array(9).fill(items()[0]) }), /tối đa 10/);
  const safe = bookingPlanView(f.session); assert.equal(safe.items[0].seed, undefined); assert.equal(safe.items[0].draft, undefined);
  assert.deepEqual(bookingPlanView(structuredClone(f.session)), safe);
});

// Dùng điều phối, xác nhận và graph thật; thay service có tác dụng ngoài bằng fixture.
function loader(mocks, env = {}) {
  const root = path.resolve(__dirname, '../src'), cache = new Map();
  const mongoose = require('mongoose');
  const isolated = { ...mongoose, model: mongoose.model.bind(new mongoose.Mongoose()) };
  function load(file) {
    const filename = path.resolve(root, file);
    if (cache.has(filename)) return cache.get(filename);
    const exports = {}; cache.set(filename, exports);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    vm.runInNewContext(code, { exports, Date, Map, Set, Buffer, URL, AbortSignal, JSON, structuredClone, console, setTimeout, clearTimeout,
      process: { env, stdout: { isTTY: false } }, require(name) { const key = Object.keys(mocks).find(key => name.endsWith(key));
        if (key) return mocks[key];
        if (name === 'mongoose') return isolated;
        return name.startsWith('.') ? load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts'))) : require(name);
      } }, { filename }); return exports;
  }
  return load;
}

test('FAQ công khai trả lời trước model, kiểm tra bản công bố và bỏ qua khi câu hỏi phụ thuộc ngữ cảnh', async () => {
  const f = fixture();
  const env = { AI_KNOWLEDGE_ENABLED: 'true' };
  const filters = [];
  let published = true, calls = 0;
  const load = loader({
    '/agentBooking.service': { AgentBookingService: {} }, '/agentAddress.service': {},
    '/agentPayment.service': { agentPaymentResultSchema: z.object({}) },
    '/aiKnowledge.model': { AiKnowledgeDocument: { exists: filter => {
      filters.push(filter);
      return { maxTimeMS() { return this; }, exec: async () => published ? { _id: filter._id } : null };
    } } },
  }, env);
  const { AgentLoop } = load('ai/agent/agent-loop.service.ts');
  const { ToolRegistry } = load('ai/tools/tool-registry.ts');
  const { runCustomerModelGraph } = load('ai/graphs/customer-model.graph.ts');
  const { measureCustomerStage, observeCustomerTurn } = load('ai/runtime/customer-runtime-metrics.ts');
  const tool = { name: 'search_customer_knowledge', description: 'Tra cứu kiến thức công khai', roles: ['CUSTOMER'],
    mutates: false, requiresConfirmation: false, inputSchema: z.object({}) };
  const model = { generate: async () => { calls++; return { type: 'FINAL', message: 'Phản hồi từ model' }; } };
  const loop = new AgentLoop(model, new ToolRegistry().register(tool),
    { maxIterations: 8, timeoutMs: 1000, systemPrompt: '' }, undefined, runCustomerModelGraph);
  const events = [];
  const send = async (message, attachments) => {
    f.session.activeRequest = { requestId: randomUUID(), digest: randomUUID(),
      input: { message, customerAttachments: attachments } };
    f.session.conversation.push({ role: 'user', content: message, customerAttachments: attachments });
    await observeCustomerTurn(async () => {
      await loop.run(f.session, f.context, async () => {});
      return f.session;
    }, event => events.push(event));
    return f.session.conversation.at(-1).content;
  };

  const question = 'Handigo hỗ trợ thanh toán bằng cách nào?';
  assert.match(await send(question), /ví Handigo.*PayOS.*tiền mặt/);
  assert.equal(calls, 0);
  assert.equal(f.session.state, 'COMPLETED');
  assert.equal(filters[0].status, 'active');
  assert.equal(filters[0].scope, 'CUSTOMER_PUBLIC');
  assert.ok(Object.keys(filters[0]).some(key => /^publications\.[a-f0-9]{64}$/.test(key)));
  assert.equal(events[0].cache[0].hits, 1);
  assert.equal(events[0].stages.some(item => item.stage === 'model_request'), false);

  assert.equal(await send(question, ['https://example.com/anh.png']), 'Phản hồi từ model');
  assert.equal(await send('Đơn này thanh toán bằng cách nào?'), 'Phản hồi từ model');
  assert.equal(filters.length, 1);
  published = false;
  assert.equal(await send(question), 'Phản hồi từ model');
  assert.equal(filters.length, 2);
  assert.equal(events.at(-1).cache[0].misses, 1);
  assert.equal(calls, 3);
  assert.equal(await loop.answerBookingFaq(f.session, { ...f.context, user: { ...user, role: 'PROVIDER' } }), undefined);
  assert.equal(filters.length, 2);

  const summary = new (load('ai/runtime/customer-metrics-summary.ts').CustomerMetricsSummary)();
  for (const event of events) summary.add(event);
  await observeCustomerTurn(() => measureCustomerStage('model_request', async () => f.session), event => summary.add(event));
  const report = summary.report();
  assert.equal(report.modelCalls, 4);
  assert.equal(report.cache.find(item => item.name === 'faq').hitRate, 1 / 3);
});

test('Cache danh mục gộp truy vấn, hết hạn, và không ghi lại kết quả cũ sau vô hiệu hóa', async ({ mock }) => {
  mock.timers.enable({ apis: ['Date'] });
  let loads = 0;
  let releaseOld;
  const load = loader({
    '/category.model': { Category: { distinct: () => {
      loads++;
      if (loads === 3) return new Promise(resolve => { releaseOld = resolve; });
      return Promise.resolve([addressId]);
    }, findOne: async () => ({ isActive: true, save: async () => {} }) } },
    '/service.model': { Service: {
      collection: { name: 'services' },
      countDocuments: async filter => filter.categoryId.$in.length,
      find: () => ({ select() { return this; }, sort() { return this; }, limit() { return this; }, lean: async () => [] }),
    } },
    '/order.model': { Order: { aggregate: async () => [] } },
  });
  const { getAgentServiceCatalog: catalog } = load('services/agentCatalog.service.ts');
  const { deleteCategory } = load('services/category.service.ts');
  const lookups = [];
  const record = hit => lookups.push(hit);
  const [first, second] = await Promise.all([catalog(record), catalog(record)]);
  assert.equal(first.total, 1);
  assert.equal(second.total, 1);
  first.total = 99;
  assert.equal((await catalog(record)).total, 1);
  assert.equal(loads, 1);
  assert.deepEqual(lookups, [false, true, true]);
  mock.timers.tick(60_001);
  await catalog(record);
  assert.equal(loads, 2);
  mock.timers.tick(60_001);
  const old = catalog(record);
  await deleteCategory(addressId);
  assert.equal((await catalog(record)).total, 1);
  releaseOld([]);
  assert.equal((await old).total, 0);
  assert.equal((await catalog(record)).total, 1);
  assert.equal(loads, 4);
  assert.equal((await catalog()).total, 1);
  assert.equal(loads, 4);
});

test('Cache embedding chỉ dùng chung cụm công khai và tách riêng thế hệ embedding', async ({ mock }) => {
  mock.timers.enable({ apis: ['Date'] });
  const load = loader({});
  const { cacheQueryEmbeddings } = load('ai/knowledge/embeddings/query-embedding-cache.ts');
  let calls = 0;
  let unavailable = false;
  const loadVector = async () => {
    calls++;
    if (unavailable) throw new Error('Embedding tạm lỗi');
    return [[calls]];
  };
  const provider = cacheQueryEmbeddings({ generation: 'generation-a', embed: loadVector });
  const other = cacheQueryEmbeddings({ generation: 'generation-b', embed: loadVector });
  const signal = new AbortController().signal;
  const query = ['phương thức thanh toán'];
  const first = await provider.embed(query, 'query', signal);
  first[0][0] = 99;
  assert.equal((await provider.embed(query, 'query', signal))[0][0], 1);
  assert.equal((await other.embed(query, 'query', signal))[0][0], 2);
  await provider.embed(query, 'document', signal);
  const privateQuery = ['phương thức thanh toán của đơn tôi'];
  await provider.embed(privateQuery, 'query', signal);
  await provider.embed(privateQuery, 'query', signal);
  assert.equal(calls, 5);
  mock.timers.tick(600_001);
  unavailable = true;
  await assert.rejects(provider.embed(query, 'query', signal), /tạm lỗi/);
  unavailable = false;
  assert.equal((await provider.embed(query, 'query', signal))[0][0], 7);
  const aborted = new AbortController();
  aborted.abort(new Error('Đã hủy'));
  await assert.rejects(provider.embed(query, 'query', aborted.signal), /Đã hủy/);
  assert.equal(calls, 7);
});

test('Công cụ tra cứu Atlas tự dùng lại embedding và đọc nguồn mỗi lượt', async () => {
  let embeddings = 0;
  let searches = 0;
  const load = loader({
    '/embedding-provider': { createEmbeddingProvider: ({ generation }) => ({ generation, embed: async () => [[++embeddings]] }) },
    '/atlas-retriever': { retrieveAtlasKnowledge: async (query, _topic, _config, provider, signal) => {
      searches++;
      assert.equal((await provider.embed([query], 'query', signal))[0][0], 1);
      return [{ title: `Kết quả ${searches}` }];
    } },
  }, { AI_KNOWLEDGE_ENABLED: 'true' });
  const { searchCustomerKnowledgeTool } = load('ai/tools/implementations/search-customer-knowledge.tool.ts');
  const { context } = fixture();
  const args = { query: 'phương thức thanh toán' };
  assert.equal((await searchCustomerKnowledgeTool.execute(context, args)).articles[0].title, 'Kết quả 1');
  assert.equal((await searchCustomerKnowledgeTool.execute(context, args)).articles[0].title, 'Kết quả 2');
  assert.equal(embeddings, 1);
});

test('Lỗi công cụ ở nhánh trực tiếp có log nhận diện, giữ cơ chế thử lại và không lộ dữ liệu đầu vào', async () => {
  const logs = [];
  const load = loader({
    '/logger': { createLogger: scope => ({ warn: (message, details) => logs.push({ scope, message, details }) }) },
    '/agentBooking.service': { AgentBookingService: {} }, '/agentAddress.service': {},
    '/agentPayment.service': { agentPaymentResultSchema: z.object({}) },
  });
  const { AgentLoop } = load('ai/agent/agent-loop.service.ts');
  const { ToolRegistry } = load('ai/tools/tool-registry.ts');
  for (const name of ['update_booking_draft', 'analyze_repair_images']) {
    const f = fixture();
    const tool = { name, description: 'Công cụ thử nghiệm', inputSchema: z.object({ description: z.string() }),
      roles: ['CUSTOMER'], mutates: false, requiresConfirmation: false,
      execute: async () => { throw Object.assign(new Error('Chi tiết nội bộ không được công bố'), { name: 'MongoNetworkError', code: 'ECONNRESET' }); } };
    const registry = new ToolRegistry().register(tool);
    const loop = new AgentLoop({ generate: async () => assert.fail('Nhánh trực tiếp không gọi model') }, registry,
      { maxIterations: 8, timeoutMs: 20000, systemPrompt: '' });
    const reply = await loop.executeTurnPlan(f.session, f.context, async () => {},
      { kind: 'history', tool: name, args: { description: 'Nội dung riêng của khách' } });
    assert.equal(f.session.state, 'FAILED');
    assert.equal(f.session.requiresReconciliation, false);
    assert.equal(f.session.recovery.tool, name);
    assert.match(reply, name === 'update_booking_draft' ? /Chưa chuẩn bị được thông tin đặt lịch/ : /Chưa đọc được ảnh hiện trạng/);
    const log = logs.at(-1);
    assert.equal(log.scope, 'AgentTool');
    assert.equal(log.details.tool, name);
    assert.equal(log.details.stage, 'execute');
    assert.equal(log.details.errorType, 'MongoNetworkError');
    assert.equal(log.details.errorCode, 'ECONNRESET');
    assert.equal(log.details.requestId, f.session.activeRequest.requestId);
    assert.doesNotMatch(JSON.stringify(log), /Nội dung riêng|Chi tiết nội bộ/);
  }
});

for (const legacy of [false, true]) test(`Tiếp tục đọc đúng ảnh và mô tả của lượt lỗi (${legacy ? 'phiên cũ chưa ghim ảnh' : 'phiên mới ghim ảnh'})`, async () => {
  const reads = [];
  const url = 'https://example.com/dieu-hoa.png', unrelated = 'https://example.com/anh-cu.png';
  const description = 'Điều hòa rò nước, xem ảnh giúp tôi';
  const load = loader({
    '/logger': { createLogger: () => ({ warn() {} }) },
    '/agentBooking.service': { AgentBookingService: { search: async () => [] } }, '/agentAddress.service': {},
    '/agentPayment.service': { agentPaymentResultSchema: z.object({}) },
    '/repairNews.service': { searchRepairArticles: async () => [] },
    '/repairImageAnalysis.service': { analyzeRepairImages: async (urls, text) => {
      reads.push({ urls: [...urls], description: text });
      if (reads.length === 1) throw new Error('Lỗi đọc ảnh thử nghiệm');
      return { relevant: true, readable: true, device: 'Điều hòa', observations: ['Nước chảy từ điều hòa'], errorCodes: [], visibleHazards: [], questions: [] };
    } },
  });
  const { AgentLoop } = load('ai/agent/agent-loop.service.ts');
  const { ToolRegistry } = load('ai/tools/tool-registry.ts');
  const tool = load('ai/tools/implementations/analyze-repair-images.tool.ts').analyzeRepairImagesTool;
  const registry = new ToolRegistry().register(tool);
  const loop = new AgentLoop({ generate: async () => assert.fail('Chưa cần model để đọc lại ảnh') }, registry,
    { maxIterations: 8, timeoutMs: 20000, systemPrompt: '' });
  const f = fixture();
  f.session.uploadedAttachments = [url, unrelated];
  f.session.conversation.push({ role: 'user', content: 'Ảnh của yêu cầu đã xong', customerAttachments: [unrelated] },
    { role: 'user', content: description, customerAttachments: [url] });
  await loop.execute(f.session, f.context, tool, { description }, async () => {});
  assert.equal(f.session.recovery.tool, 'analyze_repair_images');
  assert.equal(f.session.recovery.arguments.description, description);
  if (legacy) delete f.session.recovery.arguments.customerAttachments;
  else assert.deepEqual([...f.session.recovery.arguments.customerAttachments], [url]);
  f.session.conversation.push({ role: 'user', content: 'Tiếp tục yêu cầu.' }, { role: 'user', content: 'Tiếp tục yêu cầu.' });
  f.session.activeRequest = { requestId: randomUUID(), digest: 'thu-lai', input: { message: 'Tiếp tục yêu cầu.' } };
  const plan = loop.planTurn(f.session, f.context);
  assert.equal(plan.tool, tool.name);
  assert.deepEqual([...plan.args.customerAttachments], [url]);
  await loop.executeTurnPlan(f.session, f.context, async () => {}, plan);
  assert.deepEqual(reads, [{ urls: [url], description }, { urls: [url], description }]);
  assert.equal(f.session.progress.at(-1).status, 'SUCCEEDED');
  assert.equal(f.session.recovery, undefined);
  assert.equal(f.session.collectedInformation.analyze_repair_images.advice.cases[0].id, 'ac-water');
  f.session.conversation.push({ role: 'user', content: 'Một yêu cầu mới không có ảnh' });
  await assert.rejects(tool.execute(f.context, { description: 'Xem ảnh cho yêu cầu mới' }), /Vui lòng đính kèm ảnh/);
  await assert.rejects(tool.execute(f.context, { description, customerAttachments: [] }), /Vui lòng đính kèm ảnh/);
  await assert.rejects(tool.execute(f.context, { description, customerAttachments: ['https://example.com/anh-khac.png'] }), /Ảnh chưa được tải lên/);
  assert.equal(reads.length, 2);
});

for (const scenario of ['phuc-hoi', 'van-qua-tai', 'cam-truy-cap', 'huy-khi-cho']) test(`Graph xử lý lỗi model có giới hạn và giữ yêu cầu gốc (${scenario})`, async () => {
  const waits = [], requests = [];
  const controller = new AbortController();
  const load = loader({
    '/logger': { createLogger: () => ({ warn() {} }) },
    '/agentBooking.service': { AgentBookingService: {} }, '/agentAddress.service': {},
    '/agentPayment.service': { agentPaymentResultSchema: z.object({}) },
    'node:timers/promises': { setTimeout: async milliseconds => {
      waits.push(milliseconds);
      if (scenario === 'huy-khi-cho') { controller.abort(); throw new Error('Đã hủy lượt thử nghiệm'); }
    } },
  });
  const { AgentLoop } = load('ai/agent/agent-loop.service.ts');
  const { AgentModelWorkflow } = load('ai/agent/model-workflow.ts');
  const { ProviderHttpError } = load('ai/llm/providers/provider-http.ts');
  const { ToolRegistry } = load('ai/tools/tool-registry.ts');
  const { runCustomerModelGraph } = load('ai/graphs/customer-model.graph.ts');
  const f = fixture();
  const image = 'https://example.com/dieu-hoa.png';
  const message = 'Điều hòa nhà tôi bị rò nước, có cách xử lý không?';
  f.context.signal = controller.signal;
  f.session.activeRequest.input = { requestId: f.session.activeRequest.requestId, message, customerAttachments: [image] };
  f.session.conversation.push({ id: 'tin-goc', role: 'user', content: message, customerAttachments: [image] });
  const loop = new AgentLoop({ generate: async request => {
    requests.push(request);
    if (scenario === 'phuc-hoi' && requests.length === 3) return { type: 'FINAL', message: 'Đã đọc được yêu cầu của bạn.' };
    throw new ProviderHttpError(scenario === 'cam-truy-cap' ? 403 : 503);
  } }, new ToolRegistry(), { maxIterations: 8, timeoutMs: 20000, systemPrompt: '' }, undefined, runCustomerModelGraph);
  loop.execute = async () => assert.fail('Thử lại model không thực thi công cụ nghiệp vụ');
  const workflow = new AgentModelWorkflow(loop, f.session, f.context, async () => {}, true);
  await runCustomerModelGraph(workflow);
  const expectedCalls = ['phuc-hoi', 'van-qua-tai'].includes(scenario) ? 3 : 1;
  assert.equal(requests.length, expectedCalls);
  assert.equal(waits.length, scenario === 'cam-truy-cap' ? 0 : scenario === 'huy-khi-cho' ? 1 : 2);
  for (const [index, milliseconds] of waits.entries()) assert.ok(milliseconds >= 1000 * 2 ** index && milliseconds < 1000 * 2 ** index + 250);
  assert.equal(workflow.frame.iteration, 1);
  assert.equal(f.session.state, scenario === 'phuc-hoi' ? 'COMPLETED' : 'FAILED');
  assert.equal(Boolean(workflow.frame.waitingForModelRetry), ['van-qua-tai', 'huy-khi-cho'].includes(scenario));
  for (const request of requests) {
    const original = request.conversation.find(item => item.id === 'tin-goc');
    assert.equal(original.content, message);
    assert.deepEqual([...original.customerAttachments], [image]);
  }
});

for (const graph of [false, true]) for (const lost of [false, true]) test(`Hai đơn xác nhận riêng, phát lại, từ chối, form cũ và đối soát (${graph ? 'graph' : 'legacy'}, ${lost ? 'mất kết quả' : 'bình thường'})`, async () => {
  const f = fixture(), writes = [], version = 'a'.repeat(64);
  const booking = { service: async () => ({ id: serviceId, name: 'Vệ sinh điều hòa', serviceType: 'fixed_price', fixedPrice: 100000, requiresOptionSelection: false, options: [] }),
    addresses: async () => [{ id: addressId, fullAddress: '12 Lê Lợi', ward: 'Phường A', province: 'Đà Nẵng', isDefault: true }],
    search: async () => [], vouchers: async () => [], price: async () => ({ amount: 100000 }),
    preview: async (_user, args) => ({ ...args, amount: 100000, addressVersion: 'v1', title: 'Đặt dịch vụ', policyVersion: version, serviceType: 'fixed_price' }),
    create: async (_user, args) => { writes.push(args); if (lost && writes.length === 1) throw Error('Mất phản hồi sau khi ghi đơn'); return result(writes.length); },
    reconcileBooking: async () => result(1) };
  function result(number) { const args = writes[number - 1]; return { orderId: String(number).padStart(24, '0'), orderCode: `ORD-${number}`, orderType: args.orderType, bookingStatus: 'created', paymentMethod: args.paymentMethod }; }
  const load = loader({ '/agentBooking.service': { AgentBookingService: booking }, '/agentAddress.service': {},
    '/agentPayment.service': { AgentPaymentService: {}, agentPaymentResultSchema: z.object({ orderId: z.string(), status: z.string(), message: z.string() }) },
    '/agentOrderProgress.service': { combineAgentBookingPayment: async () => {} },
    '/agentAssignedProvider.service': { agentAssignedProviderSchema: z.object({ orderId: z.string() }) },
    '/agentFeedback.service': { agentFeedbackSchema: z.object({}) }, '/bookingPolicy.service': { getCustomerBookingPolicies: async () => ({ version }) } });
  const { AgentLoop } = load('ai/agent/agent-loop.service.ts'), { AgentService } = load('ai/agent/agent.service.ts');
  const { ToolRegistry } = load('ai/tools/tool-registry.ts');
  const registry = new ToolRegistry().register(load('ai/tools/implementations/booking-plan.tool.ts').bookingPlanTool)
    .register(load('ai/tools/implementations/update-booking-draft.tool.ts').createUpdateBookingDraftTool(booking))
    .register(load('ai/tools/implementations/create-booking.tool.ts').createBookingTool);
  const list = items(); list[1].seed = { ...list[0].seed, recipientName: 'Trần Bình', recipientPhone: '0987654321', quantity: 1 };
  const responses = [{ type: 'TOOL_CALL', tool: 'manage_booking_plan', arguments: { action: 'create', items: list } },
    ...Array.from({ length: 5 }, () => ({ type: 'TOOL_CALL', tool: 'update_booking_draft', arguments: {} }))];
  let dispatcher;
  if (graph) {
    const records = new Map();
    const ledger = { find: async key => records.get(JSON.stringify(key)), reserve: async identity => {
      const key = JSON.stringify(identity), old = records.get(key), record = old ?? { ...identity, status: 'EXECUTING', startedAt: new Date().toISOString() };
      records.set(key, record); return { record, inserted: !old };
    }, settle: async (key, status, result) => { const id = JSON.stringify(key), record = { ...records.get(id), status, result }; records.set(id, record); return record; } };
    dispatcher = new (load('ai/runtime/action-graph-dispatcher.ts').ActionGraphDispatcher)(registry, ledger, async () => {});
  }
  const loop = new AgentLoop({ generate: async () => responses.shift() }, registry, { maxIterations: 8, timeoutMs: 20000, systemPrompt: '' }, dispatcher,
    graph ? load('ai/graphs/customer-model.graph.ts').runCustomerModelGraph : undefined);
  f.session.activeRequest = null;
  const service = new AgentService({ acquire: async () => ({ session: f.session, lockId: 'khóa' }), save: async () => {}, release: async () => {} }, loop);
  const send = input => service.send(user, f.session.id, { requestId: randomUUID(), ...input });
  let view = await send({ message: 'Đặt vệ sinh máy lạnh và sửa ống nước theo hai yêu cầu riêng.' });
  assert.equal(writes.length, 0); assert.equal(view.pendingConfirmation.tool, 'create_booking');
  const first = { requestId: randomUUID(), confirmation: { actionId: view.pendingConfirmation.actionId, decision: 'CONFIRM', policyConsent: { accepted: true, version } } };
  view = await service.send(user, f.session.id, first); await service.send(user, f.session.id, first);
  if (lost) {
    assert.equal(view.requiresReconciliation, true); assert.equal(view.bookingPlan.items[0].status, 'active');
    view = await send({ message: 'Kiểm tra kết quả tạo đơn, không tạo lại.' });
    assert.equal(view.requiresReconciliation, false);
  }
  assert.equal(writes.length, 1); assert.equal(view.bookingPlan.items[0].status, 'created');
  const staleRevision = view.bookingDraft.revision;
  view = await send({ message: 'Tiếp tục việc thứ hai.', bookingAction: { type: 'plan', plan: { action: 'next', planId: view.bookingPlan.id, revision: view.bookingPlan.revision } } });
  assert.equal(writes.length, 1); assert.equal(view.pendingConfirmation.tool, 'create_booking');
  assert.equal(view.pendingConfirmation.preview.recipientName, 'Trần Bình');
  const oldAction = view.pendingConfirmation.actionId;
  view = await send({ message: 'Sửa từ form cũ.', bookingAction: { type: 'update', revision: staleRevision, patch: { recipientName: 'Tên Sai' } } });
  assert.equal(view.bookingDraft.values.recipientName, 'Trần Bình'); assert.equal(view.pendingConfirmation, null);
  view = await send({ message: 'Kiểm tra lại bản nháp.', bookingAction: { type: 'update', revision: view.bookingDraft.revision, patch: { mode: 'resume' } } });
  await assert.rejects(send({ confirmation: { actionId: oldAction, decision: 'CONFIRM', policyConsent: { accepted: true, version } } }));
  view = await send({ confirmation: { actionId: view.pendingConfirmation.actionId, decision: 'REJECT' } });
  assert.equal(writes.length, 1); assert.equal(view.bookingPlan.items[1].status, 'active');
  view = await send({ message: 'Đổi tên người nhận rồi tiếp tục.', bookingAction: { type: 'update', revision: view.bookingDraft.revision, patch: { recipientName: 'Trần Bình Mới' } } });
  view = await send({ confirmation: { actionId: view.pendingConfirmation.actionId, decision: 'CONFIRM', policyConsent: { accepted: true, version } } });
  assert.equal(writes.length, 2); assert.equal(writes[0].recipientName, 'Nguyễn An'); assert.equal(writes[1].recipientName, 'Trần Bình Mới');
  assert.equal(view.bookingPlan.items.filter(item => item.status === 'created').length, 2);
});
