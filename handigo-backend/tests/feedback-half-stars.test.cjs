const { test } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node/register/transpile-only');
const { createFeedbackSchema, updateFeedbackSchema, feedbackListQuerySchema } = require('../src/validations/feedback.validator');
const { Feedback } = require('../src/models/feedback.model');
const { Service } = require('../src/models/service.model');
const { getServiceFeedbacks } = require('../src/services/feedback.service');
const orderId = '507f1f77bcf86cd799439011';
for (const rating of [1, 1.5, 2.5, 3.5, 4.5, 5]) {
  test(`Tạo, sửa và lọc đánh giá nhận đúng mức ${rating} sao`, () => {
    assert.equal(createFeedbackSchema.parse({ orderId, rating }).rating, rating);
    assert.equal(updateFeedbackSchema.parse({ rating }).rating, rating);
    assert.equal(feedbackListQuerySchema.parse({ rating: String(rating) }).rating, rating);
    const document = new Feedback({ orderId, serviceId: orderId, customerId: orderId, providerId: orderId, rating });
    assert.equal(document.rating, rating);
    assert.equal(document.validateSync()?.errors.rating, undefined);
  });
}
for (const rating of [0.5, 0, 5.5, -1, 1.2, 4.75, NaN, Infinity]) {
  test(`Từ chối mức sao ngoài khoảng 1–5 hoặc không theo bước 0,5: ${rating}`, () => {
    assert.equal(createFeedbackSchema.safeParse({ orderId, rating }).success, false);
    assert.equal(updateFeedbackSchema.safeParse({ rating }).success, false);
    assert.equal(feedbackListQuerySchema.safeParse({ rating }).success, false);
  });
}
test('Bộ lọc 4,5 sao không bị bỏ qua trong truy vấn database', async () => {
  let filter;
  const originalExists = Service.exists, originalFind = Feedback.find, originalCount = Feedback.countDocuments;
  Service.exists = async () => ({ _id: orderId });
  const chain = { select() { return this; }, sort() { return this; }, skip() { return this; }, limit() { return this; }, populate() { return this; }, lean: async () => [] };
  Feedback.find = query => { filter = query; return chain; };
  Feedback.countDocuments = async () => 0;
  try {
    await getServiceFeedbacks(orderId, { rating: 4.5 });
    assert.equal(filter.rating, 4.5);
  } finally { Service.exists = originalExists; Feedback.find = originalFind; Feedback.countDocuments = originalCount; }
});