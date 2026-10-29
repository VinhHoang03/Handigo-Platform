const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');
const { Feedback } = require('../src/models/feedback.model');
const { Order } = require('../src/models/order.model');
const { Service } = require('../src/models/service.model');
const User = require('../src/models/user.model').default;
const { OrderStatus } = require('../src/models/orderStatus.model');
const { getAdminFeedbacks } = require('../src/services/feedback.service');
const { adminFeedbackListQuerySchema } = require('../src/validations/feedback.validator');
const id = '507f1f77bcf86cd799439011';

test('Bộ lọc danh mục và sắp xếp chỉ nhận giá trị hợp lệ', () => {
  assert.equal(adminFeedbackListQuerySchema.parse({ categoryId: id, sort: 'newest' }).categoryId, id);
  assert.equal(adminFeedbackListQuerySchema.safeParse({ categoryId: 'sai' }).success, false);
  assert.equal(adminFeedbackListQuerySchema.safeParse({ sort: 'sai' }).success, false);
});

test('Lọc trước phân trang, tìm tên/mã đơn an toàn, thống kê không phụ thuộc bộ lọc', async (t) => {
  t.after(() => mock.restoreAll());
  let actualFilter;
  let actualSort;
  let aggregate;
  const lean = value => ({ select() { return this; }, async lean() { return value; } });
  mock.method(Service, 'find', filter => {
    assert.deepEqual(filter, { categoryId: id, isDeleted: false });
    return lean([{ _id: id }]);
  });
  mock.method(User, 'find', filter => {
    assert.equal(filter.fullName.$regex, 'Khách\\.\\*');
    return lean([{ _id: id }]);
  });
  mock.method(Order, 'find', () => lean([{ _id: id }]));
  mock.method(Feedback, 'find', filter => {
    actualFilter = filter;
    return {
      sort(value) { actualSort = value; return this; },
      skip(value) { assert.equal(value, 30); return this; },
      limit(value) { assert.equal(value, 30); return this; },
      populate() { return this; },
      then(resolve) { return Promise.resolve([]).then(resolve); },
    };
  });
  mock.method(Feedback, 'countDocuments', async filter => { assert.deepEqual(filter, actualFilter); return 0; });
  mock.method(Feedback, 'aggregate', async pipeline => {
    aggregate = pipeline;
    return [{ total: 90, lowRating: 8, averageRating: 4.5 }];
  });
  mock.method(OrderStatus, 'aggregate', async () => []);
  const result = await getAdminFeedbacks({ page: 2, limit: 30, categoryId: id, keyword: 'Khách.*', ratingBelow: 4, hasImages: true, replied: false, isVisible: true, sort: 'newest' });
  assert.deepEqual(actualFilter.rating, { $lt: 4 });
  assert.deepEqual(actualFilter.serviceId, { $in: [id] });
  assert.equal(actualFilter.$or.length, 3);
  assert.equal(actualFilter.comment, undefined);
  assert.equal(actualFilter.providerReply, null);
  assert.deepEqual(actualFilter['images.0'], { $exists: true });
  assert.equal(actualFilter.isVisible, true);
  assert.deepEqual(actualSort, { createdAt: -1, _id: -1 });
  assert.deepEqual(aggregate[0], { $match: { isDeleted: false } });
  assert.equal(result.moderationStats.total, 90);
  assert.equal(result.pagination.total, 0);
});
