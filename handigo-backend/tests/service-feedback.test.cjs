const { test } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');
const { Service } = require('../src/models/service.model');
const { Feedback } = require('../src/models/feedback.model');
const { Order } = require('../src/models/order.model');
const { getServiceFeedbacks } = require('../src/services/feedback.service');
const { serviceFeedbackQuerySchema } = require('../src/validations/feedback.validator');
const id = '507f1f77bcf86cd799439011';
const optionId = '507f1f77bcf86cd799439012';

test('Kiểm tra bộ lọc, phân trang và giới hạn đầu vào', () => {
  const value = serviceFeedbackQuerySchema.parse({ rating: '5', hasImages: 'true', optionId, positiveOnly: 'true', sort: 'rating' });
  assert.equal(value.rating, 5);
  assert.equal(value.hasImages, true);
  for (const query of [{ rating: 6 }, { limit: 51 }, { page: 0 }, { optionId: 'sai' }, { sort: 'sai' }, { keyword: 'a'.repeat(101) }]) {
    assert.equal(serviceFeedbackQuerySchema.safeParse(query).success, false);
  }
});

test('Chỉ đọc đánh giá công khai, lọc gói trong đơn và không lộ chi tiết đơn', async () => {
  let filter, orderFilter, sorting, skip, limit;
  Service.exists = async () => true;
  Order.distinct = async (_field, value) => { orderFilter = value; return ['order-1']; };
  Feedback.countDocuments = async () => 14;
  Feedback.find = value => {
    filter = value;
    const chain = {
      select() { return this; },
      sort(value) { sorting = value; return this; },
      skip(value) { skip = value; return this; },
      limit(value) { limit = value; return this; },
      populate() { return this; },
      async lean() { return [{ _id: 'review-1', rating: 5, comment: 'Tốt', images: [],
        customerId: { _id: 'customer-1', fullName: 'Nguyễn An', avatar: null, phone: 'không trả' },
        orderId: { _id: 'order-1', fullAddress: 'không trả', selectedOptionsSnapshot: [{ optionId, name: 'Gói vệ sinh', price: 123 }] } }]; },
    };
    return chain;
  };
  const result = await getServiceFeedbacks(id, { page: 2, limit: 4, positiveOnly: true, hasImages: true, keyword: 'tốt.*', optionId, sort: 'rating' });
  assert.equal(filter.isVisible, true);
  assert.equal(filter.isDeleted, false);
  assert.equal(filter.serviceId, id);
  assert.deepEqual(filter.rating, { $gte: 4 });
  assert.deepEqual(filter['images.0'], { $exists: true });
  assert.equal(filter.comment.$regex, 'tốt\\.\\*');
  assert.deepEqual(filter.orderId, { $in: ['order-1'] });
  assert.equal(orderFilter.serviceId, id);
  assert.equal(orderFilter.isDeleted, false);
  assert.equal(orderFilter.$or[0].selectedOptionIds, optionId);
  assert.equal(orderFilter.$or[1]['selectedOptionsSnapshot.optionId'], optionId);
  assert.deepEqual(sorting, { rating: -1, createdAt: -1, _id: -1 });
  assert.equal(skip, 4); assert.equal(limit, 4);
  assert.deepEqual(result.pagination, { page: 2, limit: 4, total: 14, totalPages: 4 });
  assert.deepEqual(result.items[0].customer, { fullName: 'Nguyễn An', avatar: null });
  assert.deepEqual(result.items[0].options, [{ id: optionId, name: 'Gói vệ sinh' }]);
  assert.equal(result.items[0].orderId, undefined);
  assert.equal(result.items[0].customerId, undefined);
  await getServiceFeedbacks(id, { rating: 1, positiveOnly: true });
  assert.deepEqual(filter.rating, { $in: [] });
  await getServiceFeedbacks(id, { rating: 2 });
  assert.equal(filter.rating, 2);
  assert.equal(sorting.createdAt, -1);
});

test('Từ chối mã sai hoặc dịch vụ đã bị xóa', async () => {
  await assert.rejects(getServiceFeedbacks('sai'), error => error.statusCode === 400);
  Service.exists = async () => false;
  await assert.rejects(getServiceFeedbacks(id), error => error.statusCode === 404);
});
