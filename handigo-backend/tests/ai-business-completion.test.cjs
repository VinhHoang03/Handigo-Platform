const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src');

// Chạy module thật, thay hạ tầng bằng dữ liệu cô lập; không đọc cấu hình bí mật.
function loader(mocks = {}, env = {}) {
  const cache = new Map();
  const mongoose = require('mongoose');
  const isolatedMongoose = { ...mongoose, model: mongoose.model.bind(new mongoose.Mongoose()) };
  function load(relative) {
    const filename = path.resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename);
    const exports = {}; cache.set(filename, exports);
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText, { exports, Date, Map, Set, Buffer, URL, AbortSignal, JSON, structuredClone, console, setTimeout, clearTimeout,
      process: { env }, require(name) {
        const key = Object.keys(mocks).find(key => name.endsWith(key));
        if (key) return mocks[key];
        if (name === 'mongoose') return isolatedMongoose;
        return name.startsWith('.') ? load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`))) : require(name);
      } }, { filename });
    return exports;
  }
  return load;
}
const user = { id: '111111111111111111111111', role: 'CUSTOMER' };
const orderId = '222222222222222222222222', quotationId = '333333333333333333333333', paymentId = '444444444444444444444444';
const query = value => ({ select() { return this; }, session() { return this; }, sort() { return this; },
  lean: async () => value, exec: async () => value, then: (a, b) => Promise.resolve(value).then(a, b) });
const signal = () => new AbortController().signal;

test('Bổ sung dịch vụ không bị coi là thiếu giấy tờ; tiêu chí xác minh danh tính không bị giả đạt', () => {
  const api = loader()('ai/admin/admin-ai.criteria.ts');
  const row = { _id: orderId, applicationType: 'service_addition', description: '', certificates: [] };
  assert.equal(api.incompleteApplicationReasons(row).length, 0);
  assert.equal(api.incompleteApplicationReasons({ ...row, applicationType: 'initial' }).length, 3);
  const checks = api.evaluateCriteria({ criteria: ['identity_images', 'identity_expiry', 'verified_identity'].map(kind => ({ code: kind, kind })) }, row);
  assert.equal(checks.map(x => x.status).join(','), 'pass,pass,unknown');
});

test('Hồ sơ chỉ đạt khi đủ quan sát ảnh rõ và nhất quán; ảnh trùng hai mặt phải kiểm tra thủ công', () => {
  const { applicationImagesPassed } = loader()('ai/admin/admin-ai.criteria.ts');
  const row = { identityDocument: { frontImageUrl: 'front', backImageUrl: 'back' }, certificates: [{ imageUrls: ['certificate'] }] };
  const image = url => ({ url, status: 'analyzed', relevant: true, consistent: true, observations: ['Có tài liệu rõ nét'], uncertainties: [] });
  const output = { imageAnalyses: ['front', 'back', 'certificate'].map(image) };
  assert.equal(applicationImagesPassed(row, output), true);
  for (const patch of [{ status: 'unreadable' }, { status: 'unavailable' }, { relevant: false }, { consistent: false }, { uncertainties: ['Chữ mờ'] }, { observations: [] }]) {
    assert.equal(applicationImagesPassed(row, { imageAnalyses: [image('front'), image('back'), { ...image('certificate'), ...patch }] }), false);
  }
  assert.equal(applicationImagesPassed(row, { imageAnalyses: [image('front')] }), false);
  assert.equal(applicationImagesPassed({ identityDocument: { frontImageUrl: 'front', backImageUrl: 'front' } }, output), false);
  assert.equal(applicationImagesPassed({ applicationType: 'service_addition', certificates: [] }, { imageAnalyses: [] }), true);
});

test('Ảnh thấy rõ nước gần ổ cắm trả cảnh báo trực tiếp, không tiếp tục tra bài hay dịch vụ', async () => {
  let adviceCalls = 0;
  const load = loader({ '/repairImageAnalysis.service': { analyzeRepairImages: async () => ({
    visibleHazards: ['water_near_electricity'], observations: ['Nước chảy sát ổ cắm'],
    device: 'Ống nước', errorCodes: [], questions: [], readable: true, relevant: true,
  }) },
    '/booking-attachments': { ...require('zod'), bookingAttachmentsSchema: require('zod').z.array(require('zod').z.string()), agentRequestAttachments: () => ['image'] },
    '/get-repair-advice.tool': { getRepairAdviceTool: { execute: async () => { adviceCalls++; }, reply: x => x } } });
  const result = await load('ai/tools/implementations/analyze-repair-images.tool.ts').analyzeRepairImagesTool.execute({ signal: signal() }, { description: 'Ống bếp bị gãy' });
  assert.equal(result.status, 'urgent'); assert.equal(adviceCalls, 0); assert.match(result.message, /điện giật/);
});

function quotationFixture() {
  let owned = true;
  const order = { orderCode: 'ORD-TEST', status: 'completed', paymentStatus: 'partially_paid', pricing: { baseAmount: 100000, totalPaidAmount: 100000 }, depositPaidAt: new Date() };
  const quotation = { _id: quotationId, quotationCode: 'Q-TEST', revision: 2, status: 'saved', finalAmount: 1000000, subtotalAmount: 1000000, discountAmount: 0 };
  const payments = [{ amount: 100000, paymentType: 'inspection_deposit' }];
  const api = loader({ '/assignment.service': { AssignmentService: { getQuotationByOrder: async () => ({ quotation, items: [] }) } },
    '/order.service': {}, '/agentBooking.service': {}, '/repairQuotation.model': {},
    '/agentBookingHistory.service': { ownedBooking: async () => { if (!owned) throw Error('Không có quyền'); return order; } },
    '/payment.model': { Payment: { find: filter => { assert.equal(filter.customerId, user.id); return query(payments); } } },
  })('services/agentQuotation.service.ts').AgentQuotationService;
  return { api, order, quotation, payments, foreign: () => { owned = false; } };
}
test('Báo giá trừ đúng khoản đã trả, không cộng cọc lần hai hoặc lấy thanh toán phiên bản khác', async () => {
  const f = quotationFixture();
  assert.equal((await f.api.get(user.id, orderId)).quotation.remainingDirectPaymentAmount, 900000);
  f.payments.push({ amount: 900000, paymentType: 'remaining', metadata: { quotationId, quotationRevision: 1 } });
  assert.equal((await f.api.get(user.id, orderId)).quotation.remainingDirectPaymentAmount, 900000);
  f.payments[1].metadata.quotationRevision = 2;
  const result = await f.api.get(user.id, orderId);
  assert.equal(result.quotation.remainingDirectPaymentAmount, 0); assert.equal(result.quotation.systemPaidAmount, 900000);
  f.foreign(); await assert.rejects(f.api.get(user.id, orderId));
});
test('Đơn đã trả đầy đủ và dữ liệu cũ thiếu giao dịch không bị báo nợ; đơn hủy không đòi trả thêm', async () => {
  const f = quotationFixture(); f.order.paymentStatus = 'paid';
  assert.equal((await f.api.get(user.id, orderId)).quotation.remainingDirectPaymentAmount, 0);
  f.order.paymentStatus = 'partially_paid'; f.order.status = 'cancelled';
  assert.equal((await f.api.get(user.id, orderId)).quotation.remainingDirectPaymentAmount, 0);
});

function paymentFixture() {
  const order = { orderCode: 'ORD-TEST', inspectionRequired: true, status: 'completed', paymentStatus: 'partially_paid' };
  const payments = [{ _id: paymentId, paymentType: 'inspection_deposit', status: 'paid', amount: 100000 }];
  const preview = { amount: 900000, paymentType: 'remaining', quotationId, quotationRevision: 2 };
  const calls = [];
  const api = loader({ '/order.model': {}, '/payment.model': {} })('services/agentPayment.service.ts').createAgentPaymentService({
    order: async () => order, payments: async () => payments, preview: async () => ({ ...preview }), reconcile: async () => {},
    create: async (u, input, expected) => { calls.push({ u, input, expected }); payments.unshift({ _id: '555555555555555555555555', amount: 900000, status: 'paid', paymentType: 'remaining', method: 'wallet' }); order.paymentStatus = 'paid'; },
  });
  return { api, order, payments, preview, calls };
}
test('Thanh toán báo giá nhận đúng mã, phiên bản, số tiền đã xác nhận và bỏ qua cọc cũ khi kiểm tra trạng thái', async () => {
  const f = paymentFixture();
  assert.equal((await f.api.status(user, orderId)).status, 'unpaid');
  const result = await f.api.pay(user, { orderId, method: 'WALLET' }, f.preview, signal());
  assert.equal(result.status, 'paid'); assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].input.paymentType, 'REMAINING'); assert.equal(f.calls[0].input.expectedRevision, 2);
  assert.equal(f.calls[0].input.expectedAmount, 900000); assert.equal(f.calls[0].input.quotationId, quotationId);
  await assert.rejects(f.api.preview({ ...user, role: 'PROVIDER' }, { orderId, method: 'WALLET' }));
});
test('Cùng số tiền nhưng báo giá đổi phiên bản vẫn phải xác nhận lại, không gọi ghi tiền', async () => {
  const f = paymentFixture(), old = { ...f.preview }; f.preview.quotationRevision++;
  assert.equal((await f.api.pay(user, { orderId, method: 'PAYOS' }, old, signal())).status, 'blocked');
  assert.equal(f.calls.length, 0);
});
test('QR phần còn lại đang chờ hoặc bị hủy không bị cọc đã trả che mất trạng thái', async () => {
  const f = paymentFixture();
  f.payments.unshift({ _id: quotationId, paymentType: 'remaining', status: 'pending', method: 'payos', amount: 900000, gatewayResponse: { paymentLink: { checkoutUrl: 'https://pay.payos.vn/test' } } });
  assert.equal((await f.api.status(user, orderId)).status, 'pending');
  Object.assign(f.payments[0], { status: 'failed', createdAt: new Date(), metadata: { customerCancelledQr: true } });
  const failed = await f.api.status(user, orderId);
  assert.equal(failed.status, 'failed'); assert.equal(await f.api.failureConfirmed(user, failed, new Date(Date.now() - 1000).toISOString()), true);
});

test('Kiểm duyệt nhận xét chỉ đọc đúng khách và đơn, phân biệt lịch sử với bản hiện tại, không lộ người duyệt', async () => {
  let own = true;
  const api = loader({ '/feedback.service': { getOrderFeedbackContext: async (id, order) => {
    assert.equal(id, user.id); assert.equal(order, orderId); if (!own) throw Error('Không có quyền');
    return { order: { orderCode: 'ORD-TEST' }, feedback: { moderationId: paymentId, isVisible: false } };
  } }, '/feedbackModeration.service': { listFeedbackModeration: async (...args) => {
    assert.deepEqual(args, [2, 10, user.id, orderId, 'comment']);
    return { items: [{ _id: quotationId, status: 'rejected', content: 'Bản cũ', reviewedBy: 'admin-secret', reason: 'internal' }, { _id: paymentId, status: 'pending', content: 'Bản hiện tại' }], pagination: { page: 2, totalPages: 2 } };
  } } })('services/agentFeedback.service.ts').AgentFeedbackService;
  const result = await api.moderation(user.id, orderId, 2);
  assert.deepEqual(result.items.map(x => x.isCurrent), [false, true]); assert.equal(result.items[1].status, 'pending');
  assert.doesNotMatch(JSON.stringify(result), /admin-secret|internal/);
  own = false; await assert.rejects(api.moderation(user.id, orderId, 2));
});

test('Xóa đơn chưa thanh toán kiểm tra chủ sở hữu, trạng thái, phiên bản và đối soát sau mất phản hồi', async () => {
  const order = { orderCode: 'ORD-TEST', status: 'created', paymentStatus: 'unpaid', readyForMatching: false, updatedAt: new Date() };
  let own = true, deleted = false, writes = 0;
  const api = loader({ '/order.model': { Order: { findOne: filter => {
    assert.equal(filter.customerId, user.id); return query(own && (filter.isDeleted === true ? deleted : !deleted) ? order : null);
  } } }, '/order.service': { OrderService: { discardUnpaidOrder: async (id, customer, version) => {
    assert.equal(id, orderId); assert.equal(customer, user.id); assert.equal(version, order.updatedAt.toISOString());
    writes++; deleted = true; order.deletedAt = new Date();
  } } } })('services/agentUnpaidOrder.service.ts').AgentUnpaidOrderService;
  for (const patch of [{ status: 'accepted' }, { paymentStatus: 'paid' }, { readyForMatching: true }]) {
    const snapshot = { ...order }; Object.assign(order, patch); await assert.rejects(api.preview(user.id, orderId)); Object.assign(order, snapshot);
  }
  const preview = await api.preview(user.id, orderId), start = new Date(Date.now() - 1000).toISOString();
  await assert.rejects(api.discard(user.id, orderId, { ...preview, orderId: quotationId })); assert.equal(writes, 0);
  await api.discard(user.id, orderId, preview); assert.equal(writes, 1);
  assert.ok(await api.reconcile(user.id, orderId, start));
  assert.equal(await api.reconcile(user.id, orderId, new Date(Date.now() + 1000).toISOString()), null);
  own = false; assert.equal(await api.reconcile(user.id, orderId, start), null);
});

test('Công cụ mới không nhận danh tính tùy ý, chỉ khách được dùng và thao tác xóa luôn cần xác nhận', () => {
  const load = loader({ '/agentUnpaidOrder.service': {}, '/agentFeedback.service': {} });
  const discard = load('ai/tools/implementations/discard-unpaid-order.tool.ts').discardUnpaidOrderTool;
  const moderation = load('ai/tools/implementations/feedback.tools.ts').getFeedbackModerationTool;
  assert.equal(discard.roles.join(','), 'CUSTOMER'); assert.equal(discard.requiresConfirmation, true);
  assert.equal(discard.inputSchema.safeParse({ orderId, userId: quotationId }).success, false);
  assert.equal(moderation.inputSchema.safeParse({ orderId, page: -1 }).success, false);
  assert.equal(moderation.inputSchema.safeParse({ orderId, role: 'ADMIN' }).success, false);
});

for (const mode of ['clear', 'unreadable', 'irrelevant', 'inconsistent', 'download_failed', 'over_limit']) {
  test(`Pipeline AI hồ sơ đọc ảnh thật qua bộ chuẩn bị ảnh và chuyển thủ công khi ${mode}`, async () => {
    let requests = 0, downloads = 0;
    const url = n => `https://res.cloudinary.com/ai-test/image/upload/handigo/provider-applications/${user.id}/identity/${n}.png`;
    const sources = [{ id: 'application', text: 'Có kinh nghiệm sửa điện' },
      ...Array.from({ length: mode === 'over_limit' ? 9 : 2 }, (_, n) => ({ id: `image:${n + 1}`, text: 'Ảnh tài liệu đăng ký', imageUrl: url(n) }))];
    const load = loader({ '/repairImageAnalysis.service': { readUploadedImage: async () => {
      downloads++; if (mode === 'download_failed') throw Error('Không tải được');
      return { inlineData: { mimeType: 'image/png', data: 'anh-gia-lap' } };
    } }, '/provider-http': { postJson: async (_url, _headers, body) => {
      requests++;
      const input = JSON.parse(body.contents[0].parts[0].text);
      assert.ok(body.systemInstruction.parts[0].text.includes('service_addition'));
      const output = { summary: 'Phân tích hồ sơ', checks: [], evidence: [{ sourceId: 'application', quote: 'sửa điện' }],
        categoryId: null, normalizedName: null, normalizedDescription: null, duplicateServiceIds: [], classification: null,
        draftReply: null, timeline: [], missingData: [], complaintResolution: null,
        imageAnalyses: input.imageInputs.filter(x => x.available).map(image => ({ sourceId: image.sourceId,
          status: mode === 'unreadable' ? 'unreadable' : 'analyzed', relevant: mode !== 'irrelevant', consistent: mode !== 'inconsistent',
          observations: ['Có giấy tờ trong ảnh'], uncertainties: [] })) };
      return { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(output) }] } }] };
    } }, '/logger': { createLogger: () => ({ warn() {} }) } }, { ADMIN_AI_API_KEY: 'gia-lap', CLOUDINARY_NAME: 'ai-test' });
    const { output } = await load('ai/admin/admin-ai.provider.ts').generateAdminAI('provider_application', { criteria: [], instructions: '', categories: [] }, sources);
    assert.equal(requests, 1); assert.equal(downloads, mode === 'over_limit' ? 8 : 2);
    assert.equal(output.imageAnalyses.length, sources.length - 1);
    assert.equal(output.missingData.length > 0, mode !== 'clear');
    assert.equal(output.imageAnalyses[0].url, url(0));
  });
}

test('Nguồn ảnh hồ sơ bị giới hạn đúng người đăng ký, không gửi ảnh người khác sang AI', async () => {
  const image = owner => `https://res.cloudinary.com/ai-test/image/upload/handigo/provider-applications/${owner}/identity/front.png`;
  const row = { _id: orderId, userId: user.id, applicationType: 'initial', status: 'pending', serviceIds: [quotationId],
    identityDocument: { type: 'cccd', frontImageUrl: image(user.id), backImageUrl: image(orderId) }, certificates: [] };
  const load = loader({ '/providerApplication.model': { ProviderApplication: { findOne: () => query(row) } },
    '/service.model': { Service: { find: () => query([{ _id: quotationId, name: 'Sửa điện' }]) } },
  }, { CLOUDINARY_NAME: 'ai-test' });
  const result = await load('ai/admin/admin-ai.context.ts').loadContext({ sourceType: 'provider_application', sourceId: orderId });
  assert.equal(result.catalogComplete, false);
  const images = result.sources.filter(x => x.imageUrl);
  assert.equal(images.length, 1); assert.equal(images[0].imageUrl, image(user.id));
});

test('Graph xóa đơn yêu cầu xác nhận, chặn hết hạn, sai người và phát lại chỉ ghi một lần', async () => {
  const { z } = require('zod');
  const load = loader({ '/booking-draft': {}, '/agentPayment.service': {} });
  const { ToolRegistry } = load('ai/tools/tool-registry.ts'), { ConfirmationService } = load('ai/agent/confirmation.service.ts');
  const { newSession } = load('ai/agent/agent-state.ts'), { ActionGraphDispatcher } = load('ai/runtime/action-graph-dispatcher.ts');
  for (const mode of ['confirm', 'lost', 'expired', 'reject', 'foreign', 'changed']) {
    let writes = 0, record = null, version = 1;
    const tool = { name: 'discard_unpaid_order', roles: ['CUSTOMER'], mutates: true, requiresConfirmation: true,
      inputSchema: z.object({ orderId: z.string() }).strict(), preview: async () => ({ version }),
      execute: async () => { writes++; if (mode === 'lost') throw Error('Mất phản hồi'); return { message: 'Đã xóa' }; },
      reconcile: async () => writes ? { message: 'Đã đối soát' } : null };
    const registry = new ToolRegistry().register(tool), session = newSession('session', user.id);
    const ctx = { user, session, sessionId: session.id, signal: signal() };
    const action = await new ConfirmationService().prepare(tool, ctx, { orderId }); session.pendingAction = action;
    const ledger = { find: async () => record, reserve: async identity => { const inserted = !record;
      record ??= { ...identity, status: 'EXECUTING', startedAt: new Date().toISOString() }; return { record, inserted }; },
      settle: async (_key, status, result) => (record = { ...record, status, result }) };
    const dispatcher = new ActionGraphDispatcher(registry, ledger, async () => {});
    await assert.rejects(dispatcher.run(session, ctx, action)); assert.equal(writes, 0);
    session.activeRequest = { input: { confirmation: { actionId: action.id, decision: mode === 'reject' ? 'REJECT' : 'CONFIRM' } } };
    if (mode === 'expired') action.expiresAt = '2000-01-01T00:00:00Z';
    if (mode === 'foreign') ctx.user = { ...user, id: orderId };
    if (mode === 'changed') version++;
    if (!['confirm', 'lost'].includes(mode)) { await assert.rejects(dispatcher.run(session, ctx, action)); assert.equal(writes, 0); continue; }
    const first = await dispatcher.run(session, ctx, action);
    const replay = await dispatcher.run(first.session, { ...ctx, session: first.session }, first.action);
    assert.equal(replay.action.status, 'SUCCEEDED'); assert.equal(writes, 1);
  }
});

test('Đối soát thanh toán báo giá khớp cả mã và phiên bản, không dùng khoản cùng giá của phiên bản khác', async () => {
  const schemas = loader({ '/order.model': {}, '/payment.model': {} })('services/agentPayment.service.ts');
  const current = { orderId, amount: 900000, paymentType: 'remaining', quotationId, quotationRevision: 2, method: 'wallet', status: 'paid' };
  const load = loader({ '/confirmed-action.graph': {}, '/agentPayment.service': { ...schemas, AgentPaymentService: { status: async () => current } } });
  const graph = load('ai/graphs/payment.graph.ts');
  const ctx = { user, confirmedPreview: { amount: 900000, paymentType: 'remaining', quotationId, quotationRevision: 2 } };
  assert.equal((await graph.reconcileGraphPayment(ctx, { orderId, method: 'WALLET' })).status, 'paid');
  current.quotationRevision = 3;
  assert.equal(await graph.reconcileGraphPayment(ctx, { orderId, method: 'WALLET' }), null);
  current.quotationRevision = 2; current.quotationId = orderId;
  assert.equal(await graph.reconcileGraphPayment(ctx, { orderId, method: 'WALLET' }), null);
});

test('Đối soát hủy QR báo giá dùng đúng mã giao dịch đã xác nhận', async () => {
  const schemas = loader({ '/order.model': {}, '/payment.model': {} })('services/agentPayment.service.ts');
  let checked;
  const load = loader({ '/confirmed-action.graph': {}, '/agentPayment.service': { ...schemas, AgentPaymentService: {
    status: async () => ({ orderId, amount: 900000, paymentType: 'remaining', paymentId, status: 'failed' }),
    cancellationConfirmed: async (_user, _current, id) => { checked = id; return id === paymentId; },
  } } });
  const ctx = { user, confirmedPreview: { amount: 900000, paymentType: 'remaining', paymentId } };
  assert.ok(await load('ai/graphs/payment.graph.ts').reconcileGraphPaymentCancellation(ctx, { orderId }));
  assert.equal(checked, paymentId);
});
