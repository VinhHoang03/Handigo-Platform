const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');
const mongoose = require('mongoose');
const { FeedbackModeration } = require('../src/models/feedbackModeration.model');
const { Feedback } = require('../src/models/feedback.model');
const { Order } = require('../src/models/order.model');
const { Provider } = require('../src/models/provider.model');
const aiConfig = require('../src/ai/feedback/feedback-moderation.config');
const { GeminiProvider } = require('../src/ai/llm/providers/gemini.provider');
const moderation = require('../src/services/feedbackModeration.service');
const feedback = require('../src/services/feedback.service');
const controller = require('../src/controllers/feedback.controller');
const reportService = require('../src/services/feedbackModerationReport.service');
const { moderationListSchema, moderationReviewSchema, moderationIdSchema, moderationReportQuerySchema } = require('../src/validations/feedback.validator');
const userId = '507f1f77bcf86cd799439011';
const resourceId = '507f1f77bcf86cd799439012';
const providerId = '507f1f77bcf86cd799439013';
const objectId = id => new mongoose.Types.ObjectId(id);
const ai = (decision = 'allow', category = 'service_quality', evidence = '', confidence = 'high') => ({
  generate: async () => ({ type: 'FINAL', message: JSON.stringify({ decision, category, evidence, confidence }) }),
});
function setup(t) {
  t.after(() => mock.restoreAll());
  mock.method(FeedbackModeration, 'findOneAndUpdate', async (_key, update) => ({
    _id: objectId(resourceId), ...update.$setOnInsert, ...update.$set,
  }));
  mock.method(FeedbackModeration, 'updateOne', async () => ({}));
}
function chain(value) {
  return { session() { return this; }, select() { return this; }, sort() { return this; }, skip() { return this; },
    limit() { return this; }, lean: async () => value, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } };
}

function mockRatingTransaction() {
  const session = { withTransaction: async operation => operation(session), endSession: async () => {} };
  mock.method(mongoose, 'startSession', async () => session);
  mock.method(Provider, 'findOneAndUpdate', async () => ({ _id: objectId(providerId) }));
  mock.method(Order, 'find', () => ({ session() { return this; }, distinct: async () => [objectId(resourceId)] }));
  mock.method(Feedback, 'aggregate', pipeline => {
    assert.equal(pipeline[0].$match.isVisible, true);
    return { session: async () => [] };
  });
  mock.method(Provider, 'findByIdAndUpdate', async () => ({}));
  return session;
}

test('Cấu hình kiểm duyệt dùng đúng key/model riêng và chuẩn hóa khoảng trắng, tiền tố model', () => {
  const config = aiConfig.feedbackModerationAIConfig({
    FEEDBACK_MODERATION_API_KEY: '  khoa-kiem-duyet-gia-lap  ',
    FEEDBACK_MODERATION_MODEL: '  models/gemini-gia-lap  ',
    GEMINI_API_KEY: 'khoa-chatbot-gia-lap', AI_AGENT_MODEL: 'model-chatbot-gia-lap',
  });
  assert.deepEqual(config, { apiKey: 'khoa-kiem-duyet-gia-lap', model: 'gemini-gia-lap', temperature: 0, timeoutMs: 12000 });
});

test('Thiếu key/model riêng hoặc model sai không sử dụng cấu hình AI chung', () => {
  const common = { GEMINI_API_KEY: 'khoa-chatbot-gia-lap', ADMIN_AI_API_KEY: 'khoa-admin-gia-lap',
    AI_AGENT_MODEL: 'model-chatbot-gia-lap', AI_CHAT_MODEL: 'model-chatbot-gia-lap' };
  for (const env of [common,
    { ...common, FEEDBACK_MODERATION_API_KEY: 'gia-lap' },
    { ...common, FEEDBACK_MODERATION_MODEL: 'gemini-gia-lap' },
    { FEEDBACK_MODERATION_API_KEY: '  ', FEEDBACK_MODERATION_MODEL: 'gemini-gia-lap' },
    { FEEDBACK_MODERATION_API_KEY: 'gia-lap', FEEDBACK_MODERATION_MODEL: '  ' },
    { FEEDBACK_MODERATION_API_KEY: 'gia-lap', FEEDBACK_MODERATION_MODEL: '../model-sai' }]) {
    assert.throws(() => aiConfig.feedbackModerationAIConfig(env), error => error.statusCode === 503);
  }
});

test('Luồng kiểm duyệt mặc định gửi đúng key và model riêng đến Gemini', async t => {
  setup(t);
  const http = require('../src/ai/llm/providers/provider-http');
  mock.method(aiConfig, 'feedbackModerationAIConfig', () => ({
    apiKey: 'khoa-kiem-duyet-gia-lap', model: 'gemini-kiem-duyet-gia-lap', temperature: 0, timeoutMs: 12000,
  }));
  let called = false;
  mock.method(http, 'postJson', async (url, headers, body, config) => {
    called = true;
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-kiem-duyet-gia-lap:generateContent');
    assert.equal(headers['x-goog-api-key'], 'khoa-kiem-duyet-gia-lap');
    assert.equal(body.generationConfig.temperature, 0);
    assert.equal(config.timeoutMs, 12000);
    return { candidates: [{ finishReason: 'STOP', content: { parts: [{ functionCall: {
      name: 'respond_to_customer', args: await ai().generate(),
    } }] } }] };
  });
  assert.equal((await moderation.classifyFeedbackContent('Thợ ý thức kém')).decision, 'allow');
  assert.equal(called, true);
});

for (const text of ['Địt mẹ thằng thợ', 'Thợ làm như cặc', 'đ.ị.t mẹ', 'đ\u200bịt mẹ', 'ĐCM', 'f.u.c.k']) {
  test(`Chặn từ tục rõ ràng và viết lách: ${text}`, async () => {
    const result = await moderation.classifyFeedbackContent(text, { generate() { throw Error('Không cần gọi AI.'); } });
    assert.equal(result.decision, 'block');
  });
}
for (const text of ['Thợ ý thức kém, làm xong không dọn dẹp', 'Tay nghề yếu, sửa xong vẫn hỏng',
  'Thợ lớn tuổi, làm việc chậm', 'Các thợ chưa mang đủ đồ nghề', 'Giá cao, vô trách nhiệm, nghi lừa đảo', 'Tho y thuc kem']) {
  test(`Không chặn bằng từ khóa khi phản ánh chất lượng: ${text}`, async () => {
    let called = false;
    const result = await moderation.classifyFeedbackContent(text, {
      generate: async request => {
        called = true;
        assert.equal(JSON.parse(request.goal).content, text);
        assert.deepEqual(request.tools, []);
        return ai().generate();
      },
    });
    assert.equal(called, true);
    assert.equal(result.decision, 'allow');
  });
}
test('Trích dẫn lời chửi được chuyển duyệt thay vì chặn ngay', async () => {
  for (const text of ['Thợ chửi tôi là "địt mẹ"', "Tôi bị gọi là 'địt mẹ'", 'Thợ gọi tôi là cặc']) {
    const result = await moderation.classifyFeedbackContent(text, ai('review', 'quotation'));
    assert.equal(result.decision, 'review');
  }
});
test('AI chỉ chặn khi có bằng chứng khớp nội dung và đúng nhóm vi phạm', async () => {
  const text = 'Tao sẽ giết mày';
  assert.equal((await moderation.classifyFeedbackContent(text, ai('block', 'threat', text))).decision, 'block');
  assert.equal((await moderation.classifyFeedbackContent(text, ai('block', 'threat', 'không tồn tại'))).decision, 'review');
  assert.equal((await moderation.classifyFeedbackContent('Ý thức kém', ai('block', 'service_quality', 'Ý thức kém'))).decision, 'review');
  assert.equal((await moderation.classifyFeedbackContent(text, ai('allow', 'threat'))).decision, 'review');
});
test('AI lỗi, kết quả sai, thiếu cấu hình hoặc độ tin cậy thấp đều chuyển duyệt', async () => {
  for (const provider of [null, { generate: async () => { throw Error('Lỗi dịch vụ.'); } },
    { generate: async () => ({ type: 'FINAL', message: 'không phải JSON' }) },
    { generate: async () => ({ type: 'TOOL_CALL', tool: 'x', arguments: {} }) }, ai('allow', 'other', '', 'low')]) {
    assert.equal((await moderation.classifyFeedbackContent('Một nhận xét', provider)).decision, 'review');
  }
  assert.equal((await moderation.classifyFeedbackContent('  ', null)).decision, 'allow');
});
test('Được duyệt chỉ cho đúng người, tài nguyên, loại và nội dung; đổi nội dung phải kiểm tra lại', async t => {
  setup(t);
  let firstHash;
  let calls = 0;
  mock.method(FeedbackModeration, 'findOne', async key => {
    assert.equal(String(key.userId), userId);
    assert.equal(String(key.resourceId), resourceId);
    assert.equal(key.kind, 'comment');
    if (!calls++) { firstHash = key.contentHash; return { status: 'approved' }; }
    assert.notEqual(key.contentHash, firstHash);
    return null;
  });
  await moderation.assertFeedbackContentAllowed(userId, resourceId, 'comment', 'Nội dung được duyệt');
  await assert.rejects(moderation.assertFeedbackContentAllowed(userId, resourceId, 'comment', 'Địt mẹ'),
    error => error.code === 'FEEDBACK_CONTENT_BLOCKED');
});
test('Thiếu AI tạo hàng chờ một lần, yêu cầu gửi lại không tạo trùng', async t => {
  setup(t);
  let saved;
  mock.method(aiConfig, 'feedbackModerationAIConfig', () => { throw Error('Chưa cấu hình.'); });
  mock.method(FeedbackModeration, 'findOne', async () => saved);
  const update = mock.method(FeedbackModeration, 'findOneAndUpdate', async (key, changes, options) => {
    assert.equal(options.upsert, true);
    assert.equal(options.runValidators, true);
    saved = { _id: objectId(resourceId), ...changes.$setOnInsert };
    return saved;
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.equal((await moderation.assertFeedbackContentAllowed(userId, resourceId, 'comment', 'Thợ nói lời khó hiểu')).decision, 'review');
  }
  assert.equal(update.mock.callCount(), 1);
  assert.equal(saved.status, 'pending');
  assert.equal(saved.source, 'unavailable');
  await assert.rejects(moderation.assertFeedbackContentAllowed(userId, resourceId, 'reply', 'Thợ nói lời khó hiểu'),
    error => error.code === 'FEEDBACK_CONTENT_PENDING');
});
test('Duyệt dùng cập nhật có điều kiện, ghi người duyệt và không đụng điểm sao', async t => {
  setup(t);
  mock.method(FeedbackModeration, 'findOneAndUpdate', async (filter, update, options) => {
    assert.deepEqual(filter, { _id: resourceId, status: 'pending' });
    assert.equal(update.$set.reviewedBy, userId);
    assert.equal(update.$set.status, 'approved');
    assert.ok(update.$set.reviewedAt instanceof Date);
    assert.equal(options.runValidators, true);
    return { status: 'approved' };
  });
  mock.method(Feedback, 'findOneAndUpdate', () => { throw Error('Không được thay đánh giá.'); });
  assert.equal((await moderation.reviewFeedbackModeration(resourceId, userId, 'approved')).status, 'approved');
  mock.method(FeedbackModeration, 'findOneAndUpdate', async () => null);
  await assert.rejects(moderation.reviewFeedbackModeration(resourceId, userId, 'rejected'), error => error.statusCode === 409);
});
test('Danh sách cá nhân luôn lọc chủ sở hữu, ADMIN chỉ xem hàng chờ', async t => {
  setup(t);
  const filters = [];
  mock.method(FeedbackModeration, 'find', filter => { filters.push(filter); return chain([]); });
  mock.method(FeedbackModeration, 'countDocuments', async () => 0);
  await moderation.listFeedbackModeration(1, 10, userId, resourceId, 'reply');
  assert.equal(String(filters[0].userId), userId);
  assert.equal(String(filters[0].resourceId), resourceId);
  assert.equal(filters[0].kind, 'reply');
  await moderation.listFeedbackModeration(1, 10);
  assert.deepEqual(filters[1], { status: 'pending' });
});
test('Controller bỏ qua userId giả mạo trong query khi đọc hàng chờ', async t => {
  setup(t);
  mock.method(moderation, 'listFeedbackModeration', async (_page, _limit, owner) => {
    assert.equal(owner, userId); return { items: [], pagination: {} };
  });
  let result;
  await controller.listModeration({ user: { id: userId, role: 'CUSTOMER' }, query: { userId: providerId } },
    { json(value) { result = value; } });
  assert.equal(result.success, true);
});
test('Tạo, sửa cả hai nhánh phiên bản và phản hồi đều chặn trước khi ghi', async t => {
  setup(t);
  const order = { _id: objectId(resourceId), customerId: objectId(userId), providerId: objectId(providerId), status: 'completed' };
  const original = { _id: resourceId, orderId: objectId(resourceId), customerId: objectId(userId), rating: 1, comment: 'Ý thức kém' };
  mock.method(Order, 'findOne', () => chain(order));
  mock.method(Feedback, 'exists', async () => null);
  mock.method(Feedback, 'findOne', () => chain(original));
  mock.method(Provider, 'findOne', async () => ({ _id: objectId(providerId) }));
  mock.method(FeedbackModeration, 'findOne', async () => null);
  mock.method(mongoose, 'startSession', () => { throw Error('Không được bắt đầu giao dịch trước kiểm duyệt.'); });
  for (const operation of [
    () => feedback.createFeedback(userId, { orderId: resourceId, rating: 1, comment: 'Địt mẹ' }),
    () => feedback.updateMyFeedback(userId, resourceId, { rating: 5, comment: 'Địt mẹ' }),
    () => feedback.updateMyFeedback(userId, resourceId, { comment: 'Địt mẹ' }, new Date().toISOString()),
    () => feedback.upsertProviderReply(userId, resourceId, 'Địt mẹ'),
  ]) await assert.rejects(operation(), error => error.code === 'FEEDBACK_CONTENT_BLOCKED');
  assert.equal(original.rating, 1);
  assert.equal(original.comment, 'Ý thức kém');
  assert.equal(original.providerReply, undefined);
});
test('Kiểm tra ownership trước khi gọi AI hoặc tạo hàng chờ', async t => {
  setup(t);
  mock.method(Order, 'findOne', () => chain({ customerId: objectId(providerId) }));
  mock.method(FeedbackModeration, 'findOne', () => { throw Error('Không được kiểm duyệt tài nguyên người khác.'); });
  await assert.rejects(feedback.createFeedback(userId, { orderId: resourceId, rating: 1, comment: 'Nội dung' }), error => error.statusCode === 403);
  mock.method(Feedback, 'findOne', async () => null);
  await assert.rejects(feedback.updateMyFeedback(userId, resourceId, { comment: 'Nội dung' }), error => error.statusCode === 404);
});

test('Phản ánh chất lượng được AI cho phép lưu đúng 1 sao và tham gia tính điểm', async t => {
  setup(t);
  const session = { withTransaction: async operation => operation(session), endSession: async () => {} };
  mock.method(mongoose, 'startSession', async () => session);
  mock.method(aiConfig, 'feedbackModerationAIConfig', () => ({ apiKey: 'gia-lap', model: 'gemini-gia-lap', temperature: 0, timeoutMs: 12000 }));
  mock.method(GeminiProvider.prototype, 'generate', ai().generate);
  mock.method(FeedbackModeration, 'findOne', async () => null);
  mock.method(Feedback, 'exists', async () => null);
  mock.method(Feedback, 'findOne', () => chain(null));
  mock.method(Order, 'findOne', () => chain({ _id: objectId(resourceId), customerId: objectId(userId),
    providerId: objectId(providerId), serviceId: objectId(resourceId), status: 'completed' }));
  mock.method(Order, 'find', () => ({ session() { return this; }, distinct: async () => [objectId(resourceId)] }));
  let saved;
  mock.method(Feedback, 'create', async ([value]) => { saved = value; return [value]; });
  mock.method(Provider, 'findOneAndUpdate', async () => ({ _id: objectId(providerId) }));
  mock.method(Feedback, 'aggregate', pipeline => {
    assert.equal(pipeline[0].$match.isVisible, true);
    return { session: async () => [{ averageRating: 1, totalFeedbacks: 1 }] };
  });
  let statistics;
  mock.method(Provider, 'findByIdAndUpdate', async (_id, update) => { statistics = update; });
  await feedback.createFeedback(userId, { orderId: resourceId, rating: 1, comment: 'Thợ ý thức kém, sửa vẫn hỏng' });
  assert.equal(saved.rating, 1);
  assert.equal(saved.comment, 'Thợ ý thức kém, sửa vẫn hỏng');
  assert.equal(statistics.averageRating, 1);
  assert.equal(statistics.totalFeedbacks, 1);
});

test('AI chưa sẵn sàng vẫn lưu đánh giá ở trạng thái ẩn, liên kết kết quả trong cùng giao dịch', async t => {
  setup(t);
  const session = mockRatingTransaction();
  mock.method(aiConfig, 'feedbackModerationAIConfig', () => { throw Error('Chưa cấu hình.'); });
  mock.method(FeedbackModeration, 'findOne', async () => null);
  mock.method(Feedback, 'exists', async () => null);
  mock.method(Feedback, 'findOne', () => chain(null));
  mock.method(Order, 'findOne', () => chain({ _id: objectId(resourceId), customerId: objectId(userId),
    providerId: objectId(providerId), serviceId: objectId(resourceId), status: 'completed' }));
  mock.method(Feedback, 'create', async ([value], options) => {
    assert.equal(options.session, session);
    return [{ ...value, _id: objectId(resourceId) }];
  });
  let linked = false;
  mock.method(FeedbackModeration, 'updateOne', async (filter, update, options) => {
    assert.equal(String(filter._id), resourceId);
    assert.equal(String(update.$set.feedbackId), resourceId);
    assert.equal(options.session, session);
    assert.equal(options.runValidators, true);
    linked = true;
  });
  const saved = await feedback.createFeedback(userId, { orderId: resourceId, rating: 1, comment: 'Nội dung cần kiểm tra' });
  assert.equal(saved.isVisible, false);
  assert.equal(saved.rating, 1);
  assert.equal(String(saved.moderationId), resourceId);
  assert.equal(linked, true);
});

for (const versioned of [false, true]) {
  test(`Sửa lời bình cần duyệt tự ẩn, lời bình được phép không tự mở ẩn (${versioned ? 'có' : 'không'} phiên bản)`, async t => {
    setup(t);
    mockRatingTransaction();
    const record = { _id: objectId(resourceId), orderId: objectId(resourceId), providerId: objectId(providerId),
      isVisible: true, comment: 'Nội dung cũ', save: async () => {} };
    mock.method(Feedback, 'findOne', () => chain(record));
    mock.method(Feedback, 'findOneAndUpdate', async (_filter, changes, options) => {
      assert.equal(options.runValidators, true);
      Object.assign(record, changes.$set);
      return record;
    });
    let decision = 'review';
    mock.method(moderation, 'assertFeedbackContentAllowed', async () => ({ decision, moderationId: objectId(resourceId) }));
    const expectedVersion = versioned ? new Date().toISOString() : undefined;
    const hidden = await feedback.updateMyFeedback(userId, resourceId, { comment: 'Nội dung cần duyệt' }, expectedVersion);
    assert.equal(hidden.isVisible, false);
    assert.equal(hidden.comment, 'Nội dung cần duyệt');
    decision = 'allow';
    const edited = await feedback.updateMyFeedback(userId, resourceId, { comment: 'Tay nghề kém' }, expectedVersion);
    assert.equal(edited.isVisible, false);
    assert.equal(edited.comment, 'Tay nghề kém');
  });
}

test('Admin hiện đánh giá đồng thời duyệt đúng kết quả hiện tại và tính lại điểm', async t => {
  setup(t);
  const session = mockRatingTransaction();
  mock.method(Feedback, 'findOneAndUpdate', async (_filter, changes) => {
    assert.equal(changes.isVisible, true);
    return { _id: objectId(resourceId), providerId: objectId(providerId), moderationId: objectId(resourceId), isVisible: true };
  });
  let reviewed = false;
  mock.method(FeedbackModeration, 'updateOne', async (filter, update, options) => {
    assert.equal(String(filter._id), resourceId);
    assert.equal(filter.status, 'pending');
    assert.equal(update.$set.status, 'approved');
    assert.equal(update.$set.reviewedBy, userId);
    assert.equal(options.session, session);
    assert.equal(options.runValidators, true);
    reviewed = true;
  });
  assert.equal((await feedback.setFeedbackVisibility(resourceId, true, userId)).isVisible, true);
  assert.equal(reviewed, true);
  assert.equal(Provider.findByIdAndUpdate.mock.callCount(), 1);
});

test('Không duyệt hoặc tính lại điểm khi nội dung đã thay đổi sau khi admin xem', async t => {
  setup(t);
  mockRatingTransaction();
  const expectedVersion = '2026-11-06T00:00:00.000Z';
  mock.method(Feedback, 'findOneAndUpdate', async filter => {
    assert.equal(filter.updatedAt.toISOString(), expectedVersion);
    return null;
  });
  await assert.rejects(feedback.setFeedbackVisibility(resourceId, true, userId, expectedVersion), error => error.statusCode === 409);
  assert.equal(FeedbackModeration.updateOne.mock.callCount(), 0);
  assert.equal(Provider.findByIdAndUpdate.mock.callCount(), 0);
});

test('Nội dung chặn được ghi nhận kèm nguồn, gửi lại không tạo bản ghi đếm trùng', async t => {
  setup(t);
  let cached;
  mock.method(FeedbackModeration, 'findOne', async () => cached);
  const save = mock.method(FeedbackModeration, 'findOneAndUpdate', async (_key, update) => {
    cached = { _id: objectId(resourceId), ...update.$setOnInsert };
    return cached;
  });
  for (let attempt = 0; attempt < 2; attempt++) await assert.rejects(
    moderation.assertFeedbackContentAllowed(userId, resourceId, 'comment', 'Địt mẹ'), error => error.code === 'FEEDBACK_CONTENT_BLOCKED');
  assert.equal(cached.decision, 'block');
  assert.equal(cached.source, 'rules');
  assert.equal(save.mock.callCount(), 1);
});

test('Thợ không đọc hoặc phản hồi đánh giá đang ẩn bằng mã đơn hay mã đánh giá', async t => {
  setup(t);
  mock.method(Provider, 'findOne', () => chain({ _id: objectId(providerId) }));
  mock.method(Order, 'findOne', () => chain({ _id: objectId(resourceId) }));
  mock.method(Feedback, 'findOne', filter => {
    assert.equal(filter.isVisible, true);
    return { ...chain(null), populate() { return this; } };
  });
  assert.equal(await feedback.getProviderFeedbackByOrder(userId, resourceId), null);
  await assert.rejects(feedback.upsertProviderReply(userId, resourceId, 'Phản hồi'), error => error.statusCode === 404);
});

test('Báo cáo rỗng trả số 0, kỳ thời gian đúng và giới hạn phân trang đầu vào', async t => {
  setup(t);
  const aggregate = mock.method(FeedbackModeration, 'aggregate', async () => []);
  const report = await reportService.getFeedbackModerationReport(moderationReportQuerySchema.parse({}));
  assert.equal(report.summary.total, 0);
  assert.equal(report.summary.blocked, 0);
  assert.equal(report.pagination.totalPages, 1);
  assert.equal(report.period.end - report.period.start, 30 * 86400000);
  const stages = aggregate.mock.calls[0].arguments[0];
  const fields = stages.at(-1).$facet.items.at(-1).$project;
  assert.equal(fields.contentHash, undefined);
  assert.equal(fields.userId, undefined);
  assert.equal(fields.content, 1);
  assert.equal(moderationReportQuerySchema.safeParse({ limit: 51 }).success, false);
  assert.equal(moderationReportQuerySchema.safeParse({ days: '1' }).success, false);
  assert.equal(moderationReportQuerySchema.safeParse({ view: 'sai' }).success, false);
});
test('Đầu vào kiểm duyệt không nhận trạng thái tùy ý, mã sai hoặc vượt phân trang', () => {
  assert.equal(moderationListSchema.safeParse({ page: 0 }).success, false);
  assert.equal(moderationListSchema.safeParse({ limit: 51 }).success, false);
  assert.equal(moderationIdSchema.safeParse({ id: 'sai' }).success, false);
  assert.equal(moderationReviewSchema.safeParse({ status: 'pending' }).success, false);
  assert.equal(moderationReviewSchema.safeParse({ status: 'approved', userId }).success, false);
});

test('Router bảo vệ quyền duyệt ADMIN và quyền đọc nội dung cá nhân qua HTTP', async t => {
  setup(t);
  const express = require('express');
  const auth = require('../src/middlewares/auth.middleware');
  mock.method(auth, 'authMiddleware', (req, res, next) => {
    const role = req.headers['x-test-role'];
    if (!role) return res.status(401).json({ success: false });
    req.user = { id: userId, role };
    next();
  });
  mock.method(moderation, 'listFeedbackModeration', async (_page, _limit, owner) => {
    return { items: [], owner: owner ?? 'admin' };
  });
  let reviewed = 0;
  mock.method(moderation, 'reviewFeedbackModeration', async (id, admin, status) => {
    reviewed++;
    assert.equal(admin, userId);
    assert.equal(status, 'approved');
    return { _id: id, status };
  });
  const app = express();
  app.use(express.json());
  app.use('/feedback', require('../src/routes/feedback.routes').default);
  // Cô lập các module quản trị khác để kiểm tra route báo cáo không cần cấu hình thanh toán.
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const ts = require('typescript');
  const routeExports = {};
  const routeFile = path.join(__dirname, '../src/routes/admin.routes.ts');
  const unrelated = new Proxy({}, { get: (_target, name) => name === '__esModule' ? true : () => {} });
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(routeFile, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, { exports: routeExports, require(name) {
    if (name === 'express') return express;
    if (name === '../controllers/feedback.controller') return controller;
    if (name === '../validations/feedback.validator') return require('../src/validations/feedback.validator');
    if (name === '../middlewares/auth.middleware') return auth;
    if (name === '../middlewares/role.middleware') return require('../src/middlewares/role.middleware');
    if (name === '../middlewares/validate.middleware') return require('../src/middlewares/validate.middleware');
    return unrelated;
  } });
  app.use('/admin', routeExports.default);
  let reportCalls = 0;
  mock.method(reportService, 'getFeedbackModerationReport', async query => {
    reportCalls++;
    assert.equal(query.days, '30');
    return { summary: { total: 0 }, items: [] };
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/feedback/moderation`;
  assert.equal((await fetch(url)).status, 401);
  for (const role of ['CUSTOMER', 'PROVIDER', 'ADMIN']) {
    const headers = { 'x-test-role': role, 'Content-Type': 'application/json' };
    const list = await fetch(`${url}?userId=${providerId}`, { headers });
    assert.equal(list.status, 200);
    assert.equal((await list.json()).data.owner, role === 'ADMIN' ? 'admin' : userId);
    const review = await fetch(`${url}/${resourceId}`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'approved' }) });
    assert.equal(review.status, role === 'ADMIN' ? 200 : 403);
    const report = await fetch(`http://127.0.0.1:${server.address().port}/admin/feedbacks/moderation-report`, { headers });
    assert.equal(report.status, role === 'ADMIN' ? 200 : 403);
  }
  assert.equal(reviewed, 1);
  assert.equal(reportCalls, 1);
  assert.equal((await fetch(`${url}/sai`, { method: 'PATCH', headers: { 'x-test-role': 'ADMIN', 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'approved' }) })).status, 400);
});
