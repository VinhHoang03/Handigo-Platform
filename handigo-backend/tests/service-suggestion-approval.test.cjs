const { test } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');
const imagePath = require.resolve('../src/services/serviceImage.service');
require.cache[imagePath] = { id: imagePath, filename: imagePath, loaded: true, exports: {
  validateNewServiceImages: async images => { if (images.includes('https://example.com/anh-khong-hop-le.png')) throw Error('Ảnh không hợp lệ'); },
} };
const mongoose = require('mongoose');
const { ServiceSuggestion } = require('../src/models/serviceSuggestion.model');
const { Service } = require('../src/models/service.model');
const { Category } = require('../src/models/category.model');
const { Provider } = require('../src/models/provider.model');
const notificationService = require('../src/services/notification.service');
const { updateServiceSuggestion } = require('../src/services/serviceSuggestion.service');
const { createService } = require('../src/services/service.service');
const { updateServiceSuggestionSchema: schema } = require('../src/validations/serviceSuggestion.validator');
const id = '507f1f77bcf86cd799439011', categoryId = '507f1f77bcf86cd799439012', adminId = '507f1f77bcf86cd799439013';
const providerId = '507f1f77bcf86cd799439014', userId = '507f1f77bcf86cd799439015';
const draft = { categoryId, name: 'Dịch vụ đã biên tập', description: 'Mô tả đầy đủ', serviceType: 'variable_price', depositAmount: 30000, isActive: false };
const copy = value => JSON.parse(JSON.stringify(value));

// Mô phỏng kho dữ liệu có commit/rollback để phát hiện thao tác ghi thiếu session.
function harness(t, overrides = {}) {
  let state = { suggestions: [{ _id: id, providerId, suggestionType: 'service', status: 'pending', suggestedServiceName: 'Tên đề xuất', categoryId, isDeleted: false, createdServiceId: null, ...overrides }],
    notifications: [], services: [], categories: [{ _id: categoryId, name: 'Danh mục', isActive: true, isDeleted: false }] };
  let tail = Promise.resolve();
  let failLink = false;
  let failNotification = false;
  const emitted = [];
  const sessions = [];
  const query = run => {
    let session;
    const result = {
      session(value) { session = value; return result; }, populate() { return result; }, select() { return result; }, collation() { return result; },
      lean() { return Promise.resolve().then(() => run(session)); },
      then(resolve, reject) { return Promise.resolve().then(() => run(session)).then(resolve, reject); },
    };
    return result;
  };
  const store = session => session ? session.staged : state;
  t.mock.method(Provider, 'findOne', filter => query(() => {
    assert.equal(String(filter._id), providerId);
    assert.equal(filter.isDeleted, false);
    return { _id: providerId, userId };
  }));
  t.mock.method(notificationService, 'createNotificationRecord', async (input, options) => {
    assert(options.session, 'Thông báo phải được lưu cùng giao dịch');
    assert.equal(options.deferRealtime, true);
    if (failNotification) throw Error('Lỗi lưu thông báo giả lập');
    const notification = { _id: new mongoose.Types.ObjectId(), ...input };
    store(options.session).notifications.push(copy(notification));
    return notification;
  });
  t.mock.method(notificationService, 'emitRealtimeNotification', notification => {
    assert(state.notifications.some(item => item._id === String(notification._id)), 'Chỉ phát sau commit');
    emitted.push(notification);
  });
  t.mock.method(mongoose, 'startSession', async () => {
    const session = {
      ended: false,
      async withTransaction(operation) {
        const previous = tail;
        let unlock;
        tail = new Promise(resolve => { unlock = resolve; });
        await previous;
        session.staged = copy(state);
        try { const value = await operation(session); state = session.staged; return value; }
        finally { unlock(); }
      },
      async endSession() { session.ended = true; },
    };
    sessions.push(session);
    return session;
  });
  t.mock.method(ServiceSuggestion, 'findOne', filter => query(session => store(session).suggestions.find(row => row._id === String(filter._id) && !row.isDeleted) || null));
  t.mock.method(ServiceSuggestion, 'findOneAndUpdate', (filter, update, options) => query(() => {
    assert(options.session, 'Cập nhật đề xuất thiếu session');
    assert.equal(options.runValidators, true);
    if (failLink) throw Error('Lỗi ghi đề xuất giả lập');
    const row = store(options.session).suggestions.find(row => row._id === String(filter._id) && !row.isDeleted && (!filter.status || row.status === filter.status) && (filter.createdServiceId !== null || row.createdServiceId == null));
    if (!row) return null;
    Object.assign(row, copy(update.$set));
    return row;
  }));
  t.mock.method(Category, 'findOne', filter => query(session => store(session).categories.find(row => row._id === String(filter._id)) || null));
  t.mock.method(Category, 'exists', filter => query(session => store(session).categories.find(row => (!filter._id || row._id === String(filter._id)) && (!filter.slug || row.slug === filter.slug) && (!filter.iconColor || row.iconColor === filter.iconColor) && (filter.isDeleted === undefined || row.isDeleted === filter.isDeleted)) || null));
  t.mock.method(Category, 'find', () => query(session => store(session).categories));
  t.mock.method(Category, 'init', async () => {});
  t.mock.method(Category, 'create', async (input, options) => {
    const values = Array.isArray(input) ? input : [input];
    const result = values.map(value => new Category(value));
    for (const row of result) { await row.validate(); store(options?.session).categories.push(copy(row.toObject())); }
    return Array.isArray(input) ? result : result[0];
  });
  t.mock.method(Service, 'exists', filter => query(session => store(session).services.find(row => row.categoryId === String(filter.categoryId) && row.slug === filter.slug) || null));
  t.mock.method(Service, 'create', async (input, options) => {
    const values = Array.isArray(input) ? input : [input];
    const result = values.map(value => new Service(value));
    for (const row of result) { await row.validate(); store(options?.session).services.push(copy(row.toObject())); }
    return Array.isArray(input) ? result : result[0];
  });
  return { state: () => state, sessions, emitted, failLink: () => { failLink = true; }, failNotification: () => { failNotification = true; } };
}

test('Phản hồi gửi đúng một thông báo đến tài khoản người đề xuất sau commit', async t => {
  const h = harness(t);
  await updateServiceSuggestion(id, { adminNote: '  Vui lòng bổ sung mô tả  ' }, adminId);
  assert.equal(h.state().suggestions[0].status, 'pending');
  assert.equal(h.state().suggestions[0].adminNote, 'Vui lòng bổ sung mô tả');
  assert.equal(h.state().notifications.length, 1);
  assert.equal(h.emitted.length, 1);
  assert.equal(h.emitted[0].userId, userId);
  assert.equal(h.emitted[0].type, 'SYSTEM');
  assert(h.emitted[0].content.includes('Vui lòng bổ sung mô tả'));
  assert.equal(h.emitted[0].data.suggestionId, id);
});

test('Lỗi lưu thông báo rollback phản hồi và không phát realtime', async t => {
  const h = harness(t);
  h.failNotification();
  await assert.rejects(updateServiceSuggestion(id, { adminNote: 'Phản hồi' }, adminId), /Lỗi lưu thông báo/);
  assert.equal(h.state().suggestions[0].adminNote, undefined);
  assert.equal(h.state().notifications.length, 0);
  assert.equal(h.emitted.length, 0);
});

test('Duyệt hoặc từ chối không kèm phản hồi thì không gửi thông báo phản hồi', async t => {
  const h = harness(t);
  await updateServiceSuggestion(id, { status: 'rejected' }, adminId);
  assert.equal(h.state().notifications.length, 0);
  assert.equal(h.emitted.length, 0);
});

test('Validation tái sử dụng schema dịch vụ và chặn kích hoạt, sai trạng thái, hai loại liên kết hoặc lệch danh mục', () => {
  assert.equal(schema.safeParse({ status: 'approved', serviceDraft: draft }).success, true);
  for (const payload of [{ status: 'rejected', serviceDraft: draft }, { status: 'approved', serviceDraft: { ...draft, isActive: true } },
    { status: 'approved', serviceDraft: { ...draft, isActive: undefined } }, { status: 'approved', serviceDraft: { ...draft, name: '' } },
    { status: 'approved', serviceDraft: draft, createdServiceId: id }, { status: 'approved', serviceDraft: draft, categoryId: adminId }, {}]) {
    assert.equal(schema.safeParse(payload).success, false);
  }
  assert.equal(schema.safeParse({ adminNote: 'Ghi chú' }).success, true);
  assert.equal(schema.safeParse({ status: 'approved', categoryId }).success, true);
});

test('Tạo dịch vụ từ dữ liệu admin, duyệt và gắn đúng liên kết trong một transaction', async t => {
  const h = harness(t);
  const result = await updateServiceSuggestion(id, { status: 'approved', adminNote: '  Đã kiểm tra  ', serviceDraft: draft }, adminId);
  assert.equal(h.state().services.length, 1);
  const service = h.state().services[0];
  assert.equal(service.name, draft.name);
  assert.equal(service.depositAmount, 30000);
  assert.equal(service.isActive, false);
  assert.equal(service.slug, 'dich-vu-da-bien-tap');
  assert.equal(String(result.createdServiceId), service._id);
  assert.equal(result.status, 'approved');
  assert.equal(result.adminNote, 'Đã kiểm tra');
  assert.equal(String(result.reviewedBy), adminId);
  assert(h.sessions.every(session => session.ended));
});

test('Lỗi ghi kết quả duyệt rollback cả dịch vụ mới', async t => {
  const h = harness(t);
  h.failLink();
  await assert.rejects(updateServiceSuggestion(id, { status: 'approved', serviceDraft: draft }, adminId), /Lỗi ghi đề xuất/);
  assert.equal(h.state().services.length, 0);
  assert.equal(h.state().suggestions[0].status, 'pending');
  assert(h.sessions[0].ended);
});

test('Hai lần duyệt đồng thời chỉ có một dịch vụ, lần còn lại nhận 409', async t => {
  const h = harness(t);
  const result = await Promise.allSettled([1, 2].map(() => updateServiceSuggestion(id, { status: 'approved', serviceDraft: draft }, adminId)));
  assert.equal(result.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(result.find(item => item.status === 'rejected').reason.statusCode, 409);
  assert.equal(h.state().services.length, 1);
});

test('Không tạo mới cho đề xuất danh mục, đã xử lý, đã có liên kết hoặc danh mục bị xóa', async t => {
  for (const overrides of [{ suggestionType: 'category' }, { status: 'approved' }, { status: 'rejected' }, { createdServiceId: adminId }]) {
    await t.test(JSON.stringify(overrides), async child => {
      const h = harness(child, overrides);
      await assert.rejects(updateServiceSuggestion(id, { status: 'approved', serviceDraft: draft }, adminId), error => [400, 409].includes(error.statusCode));
      assert.equal(h.state().services.length, 0);
    });
  }
  await t.test('Danh mục bị xóa', async child => {
    const h = harness(child);
    h.state().categories[0].isDeleted = true;
    await assert.rejects(updateServiceSuggestion(id, { status: 'approved', serviceDraft: draft }, adminId), error => error.statusCode === 404);
    assert.equal(h.state().services.length, 0);
  });
});

test('Giữ nhánh client cũ, tạo danh mục cũ và lưu ghi chú không thay đổi trạng thái', async t => {
  await t.test('Duyệt dịch vụ không gửi draft', async child => {
    const h = harness(child);
    await updateServiceSuggestion(id, { status: 'approved', categoryId }, adminId);
    assert.equal(h.state().services[0].serviceType, 'variable_price');
    assert.equal(h.state().services[0].isActive, false);
  });
  await t.test('Duyệt danh mục', async child => {
    const h = harness(child, { suggestionType: 'category', suggestedCategoryName: 'Danh mục thử' });
    const result = await updateServiceSuggestion(id, { status: 'approved' }, adminId);
    assert.equal(h.state().categories.length, 2);
    assert(result.createdCategoryId);
  });
  await t.test('Ghi chú đề xuất đã duyệt', async child => {
    const h = harness(child, { status: 'approved', createdServiceId: adminId });
    await updateServiceSuggestion(id, { adminNote: 'Ghi chú bổ sung' }, adminId);
    assert.equal(h.state().suggestions[0].status, 'approved');
    assert.equal(h.state().services.length, 0);
  });
});

test('Trang quản lý vẫn tạo dịch vụ không truyền session; ảnh không hợp lệ không tạo dữ liệu', async t => {
  const h = harness(t);
  await createService({ ...draft });
  assert.equal(h.state().services.length, 1);
  await assert.rejects(updateServiceSuggestion(id, { status: 'approved', serviceDraft: { ...draft, name: 'Dịch vụ khác', coverImage: 'https://example.com/anh-khong-hop-le.png' } }, adminId), /Ảnh không hợp lệ/);
  assert.equal(h.state().services.length, 1);
  assert.equal(h.state().suggestions[0].status, 'pending');
});
