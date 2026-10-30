const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');
const { Feedback } = require('../src/models/feedback.model');
const { Order } = require('../src/models/order.model');
const { OrderStatus } = require('../src/models/orderStatus.model');
const { RepairQuotation } = require('../src/models/repairQuotation.model');
const { getAdminFeedbackDetail } = require('../src/services/feedback.service');
const { getAdminOrderDetail } = require('../src/services/adminOrderDetail.service');
const { roleMiddleware } = require('../src/middlewares/role.middleware');
const id = '507f1f77bcf86cd799439011';

function chain(value, selections = []) {
  return {
    select(fields) { selections.push(fields); return this; },
    populate() { return this; },
    sort() { return this; },
    async lean() { return value; },
  };
}

test('Chi tiết đánh giá có đơn, địa chỉ lúc đặt, lịch sử và thanh toán báo giá', async (t) => {
  t.after(() => mock.restoreAll());
  const selections = [];
  mock.method(Feedback, 'findOne', filter => {
    assert.deepEqual(filter, { _id: id, isDeleted: false });
    return chain({ _id: id, orderId: id, rating: 2, images: [] }, selections);
  });
  mock.method(Order, 'findOne', filter => {
    assert.deepEqual(filter, { _id: id, isDeleted: false });
    return chain({ _id: id, orderCode: 'DH01', currentQuotationId: id,
      addressId: { fullAddress: 'Địa chỉ mới' }, addressSnapshot: { fullAddress: 'Địa chỉ lúc đặt' },
      completionEvidenceImages: ['https://example.com/hoan-thanh.jpg'] }, selections);
  });
  mock.method(OrderStatus, 'find', filter => {
    assert.deepEqual(filter, { orderId: id, isDeleted: false });
    return chain([{ _id: id, status: 'completed', changedByRole: 'provider' }]);
  });
  mock.method(RepairQuotation, 'findOne', filter => {
    assert.deepEqual(filter, { _id: id, orderId: id, isDeleted: false });
    return chain({ finalAmount: 150000, directPaymentConfirmedAt: '2026-10-27T01:00:00Z' }, selections);
  });
  const result = await getAdminFeedbackDetail(id);
  assert.equal(result.feedback.rating, 2);
  assert.equal(result.order.addressId.fullAddress, 'Địa chỉ lúc đặt');
  assert.equal(result.order.statusHistory[0].status, 'completed');
  assert.equal(result.order.completionEvidenceImages.length, 1);
  assert.equal(result.quotation.quotation.finalAmount, 150000);
  assert.ok(selections.every(fields => !/password|token|credential/i.test(fields)));
});

test('Đơn đã bị xóa vẫn trả đánh giá để admin xem', async (t) => {
  t.after(() => mock.restoreAll());
  mock.method(Feedback, 'findOne', () => chain({ _id: id, orderId: id, rating: 1 }));
  mock.method(Order, 'findOne', () => chain(null));
  const result = await getAdminFeedbackDetail(id);
  assert.equal(result.feedback.rating, 1);
  assert.equal(result.order, null);
  assert.equal(result.quotation, null);
});

test('Từ chối mã sai và đánh giá không tồn tại', async (t) => {
  t.after(() => mock.restoreAll());
  await assert.rejects(getAdminFeedbackDetail('sai'), error => error.statusCode === 400);
  mock.method(Feedback, 'findOne', () => chain(null));
  await assert.rejects(getAdminFeedbackDetail(id), error => error.statusCode === 404);
});

test('Middleware ADMIN từ chối khách hàng, thợ và người chưa đăng nhập', () => {
  for (const role of [undefined, 'CUSTOMER', 'PROVIDER', 'ADMIN']) {
    let allowed = false;
    let status;
    const response = { status(value) { status = value; return this; }, json() {} };
    roleMiddleware('ADMIN')({ user: role ? { role } : undefined }, response, () => { allowed = true; });
    assert.equal(allowed, role === 'ADMIN');
    if (!allowed) assert.equal(status, 403);
  }
});

test('Mở trực tiếp đơn đang xử lý không cần có đánh giá', async (t) => {
  t.after(() => mock.restoreAll());
  mock.method(Feedback, 'findOne', () => { throw Error('Không được yêu cầu đánh giá để xem đơn.'); });
  mock.method(Order, 'findOne', filter => {
    assert.equal(filter.isDeleted, false);
    return chain({ _id: id, orderCode: 'DH02', status: 'in_progress', currentQuotationId: null });
  });
  mock.method(OrderStatus, 'find', () => chain([{ _id: id, status: 'in_progress' }]));
  const result = await getAdminOrderDetail(id);
  assert.equal(result.order.status, 'in_progress');
  assert.equal(result.order.statusHistory[0].status, 'in_progress');
  assert.equal(result.quotation, null);
  await assert.rejects(getAdminOrderDetail('sai'), error => error.statusCode === 400);
});

test('Mở trực tiếp đơn hoàn thành trả cả đánh giá và phản hồi của thợ, loại bản ghi đã xóa', async t => {
  t.after(() => mock.restoreAll());
  mock.method(Order, 'findOne', () => chain({ _id: id, status: 'completed', currentQuotationId: null }));
  mock.method(OrderStatus, 'find', () => chain([]));
  const selections = [];
  mock.method(Feedback, 'findOne', filter => {
    assert.deepEqual(filter, { orderId: id, isDeleted: false });
    return chain({ rating: 4.5, comment: 'Dịch vụ tốt', images: ['danh-gia.jpg'], providerReply: { content: 'Cảm ơn khách hàng', images: ['phan-hoi.jpg'] } }, selections);
  });
  const result = await getAdminOrderDetail(id);
  assert.equal(result.feedback.rating, 4.5);
  assert.equal(result.feedback.providerReply.content, 'Cảm ơn khách hàng');
  assert.ok(selections.every(fields => !/password|token|credential/i.test(fields)));
});
