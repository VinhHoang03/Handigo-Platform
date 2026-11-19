const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const mongoose = require('mongoose');
const { bookingSchema } = require('../dist/ai/tools/implementations/booking.schemas');
const { bookingDraftPatchSchema, updateBookingDraft, readyBookingArguments } = require('../dist/ai/agent/booking-draft');
const { vietnamesePhoneSchema } = require('../dist/validations/user.validator');
const bookingPolicy = require('../dist/utils/bookingPolicy');

// Chạy service thật với dữ liệu giả, không kết nối database, AI hoặc thanh toán.
function load(relative, mocks) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src', relative), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { exports, require: name => mocks[name] ?? {}, Date, JSON, console });
  return exports;
}
const userId = '111111111111111111111111';
const serviceId = '222222222222222222222222';
const addressId = '333333333333333333333333';
const otherAddressId = '444444444444444444444444';
const address = { _id: addressId, id: addressId, userId, fullAddress: '12 Lê Lợi', ward: 'Phường A',
  province: 'Thành phố Đà Nẵng', recipientName: 'Nguyễn An', recipientPhone: '0912345678',
  latitude: 16, longitude: 108, isDefault: true, updatedAt: new Date('2026-01-01') };
const args = { serviceId, addressId, orderType: 'scheduled', scheduledAt: '2030-10-04T09:00:00+07:00', paymentMethod: 'cash' };
const service = { _id: new mongoose.Types.ObjectId(serviceId), id: serviceId, name: 'Vệ sinh điều hòa',
  serviceType: 'fixed_price', fixedPrice: 100000, isActive: true, categoryId: { isActive: true },
  requiresOptionSelection: false, options: [] };
const pricing = { baseAmount: 100000, bookingAmount: 100000, discountedAmount: 100000,
  voucherDiscountAmount: 0, optionIds: [], selectedOptionsSnapshot: [],
  schedule: { travelMinutes: 30, durationMinutes: 60 } };

test('Số điện thoại được chuẩn hóa, số sai bị từ chối và null chỉ dùng để bỏ lựa chọn trong bản nháp', () => {
  assert.equal(bookingDraftPatchSchema.parse({ recipientPhone: '098 765 4321' }).recipientPhone, '0987654321');
  assert.equal(bookingSchema.parse({ ...args, recipientPhone: '098-765-4321' }).recipientPhone, '0987654321');
  assert.equal(bookingDraftPatchSchema.parse({ recipientPhone: null }).recipientPhone, null);
  assert.equal(bookingSchema.safeParse(args).success, true);
  for (const phone of ['', '123', '0123456789', '+84987654321', 987654321, null]) {
    assert.equal(bookingSchema.safeParse({ ...args, recipientPhone: phone }).success, false);
    if (phone !== null) assert.equal(bookingDraftPatchSchema.safeParse({ recipientPhone: phone }).success, false);
  }
});

test('Thao tác sửa từ giao diện và schema công cụ AI đều nhận số điện thoại', () => {
  const { z } = require('zod');
  const { bookingActionSchema } = load('ai/agent/booking-actions.ts', {
    zod: { z },
    './booking-draft': { bookingDraftPatchSchema },
    '../tools/implementations/booking.schemas': { idSchema: z.string() },
    '../../services/agentFeedback.service': { agentFeedbackSchema: z.object({}) },
  });
  for (const recipientPhone of ['0987654321', null]) {
    const action = bookingActionSchema.parse({ type: 'update', revision: 2, patch: { recipientPhone } });
    assert.equal(action.patch.recipientPhone, recipientPhone);
  }
  const schema = z.toJSONSchema(bookingDraftPatchSchema, { io: 'input' });
  assert.ok(schema.properties.recipientPhone);
  assert.equal(schema.required?.includes('recipientPhone') ?? false, false);
});

test('Giữ số khi sửa bản nháp, đổi địa chỉ, tạm dừng/tiếp tục; bỏ lựa chọn hoặc đặt thêm không giữ số cũ', async () => {
  const deps = { search: async () => [], service: async () => service,
    addresses: async () => [address, { ...address, id: otherAddressId, isDefault: false }],
    vouchers: async () => [], price: async () => ({ amount: 100000 }) };
  const update = (previous, patch) => updateBookingDraft(previous, bookingDraftPatchSchema.parse(patch), userId, deps);
  const first = await update(undefined, { ...args, recipientPhone: '098 765 4321' });
  assert.equal(first.values.recipientPhone, '0987654321');
  assert.match(first.summary.join(' '), /0987654321/);
  assert.equal(readyBookingArguments(first).recipientPhone, '0987654321');
  const changed = await update(first, { quantity: 2, addressId: otherAddressId, paymentMethod: 'bank' });
  const paused = await update(changed, { mode: 'pause' });
  const resumed = await update(paused, { mode: 'resume' });
  assert.equal(resumed.values.recipientPhone, '0987654321');
  assert.equal(resumed.values.addressId, otherAddressId);
  assert.equal((await update(resumed, { recipientPhone: null })).values.recipientPhone, undefined);
  assert.equal((await update(resumed, { startNew: true })).values.recipientPhone, undefined);
  const discarded = await update(resumed, { mode: 'discard' });
  assert.equal((await update(discarded, {})).values.recipientPhone, undefined);
  assert.equal(address.recipientPhone, '0912345678');
  await assert.rejects(update({ ...first, status: 'booked' }, { recipientPhone: '0901234567' }), /đã tạo đơn/);
});

function bookingFixture() {
  const { AgentBookingService } = load('services/agentBooking.service.ts', {
    '../utils/appError': require('../dist/utils/appError'),
    '../models/address.model': { Address: { findOne: async filter => {
      assert.equal(filter.userId, userId); return address;
    } } },
    './address.service': { ensureAddressCoordinates: async value => value },
    './agentAddress.service': { draftAddressDocument: () => undefined },
    './service.service': { getServiceById: async () => service },
    './servicePricing.service': { previewServiceBooking: async () => pricing },
    '../ai/agent/booking-draft': { bookingAddressLabel: value => value.fullAddress },
  });
  return AgentBookingService;
}

test('Xác nhận hiển thị số thực tế cho đơn, dùng lại số từ địa chỉ nếu không có lựa chọn riêng', async () => {
  const booking = bookingFixture();
  const preview = await booking.preview(userId, { ...args, recipientPhone: '0987654321' });
  assert.equal(preview.recipientPhone, '0987654321');
  assert.equal(preview.recipientName, address.recipientName);
  assert.equal((await booking.preview(userId, args)).recipientPhone, address.recipientPhone);
  assert.equal(address.recipientPhone, '0912345678');
});

function orderFixture() {
  const writes = [];
  const savedAddresses = [];
  let owned = true;
  const { OrderService } = load('services/order.service.ts', {
    mongoose,
    crypto: require('node:crypto'),
    '../validations/user.validator': { vietnamesePhoneSchema },
    '../utils/appError': require('../dist/utils/appError'),
    '../utils/actionPreconditionError': require('../dist/utils/actionPreconditionError'),
    '../utils/bookingPolicy': bookingPolicy,
    './penaltyPolicy.service': { assertFeatureAllowed: async () => {} },
    '../models/service.model': { Service: { findOne: async () => service } },
    '../models/category.model': { Category: { exists: async () => true } },
    '../models/address.model': { Address: { findOne: async filter => {
      assert.equal(filter.userId, userId); return owned ? address : null;
    } } },
    './address.service': { ensureAddressCoordinates: async value => value,
      createAddress: async (_user, value) => { savedAddresses.push(value); return value; } },
    './servicePricing.service': { buildServicePricingSnapshot: async () => pricing },
    './matching.service': { MatchingService: { findNearestProviders: async () => [{}] } },
    './systemConfig.service': { getNumberConfigValue: async () => 15, getBookingPolicy: async () => ({ paymentHoldMinutes: 15 }) },
    './promotion.service': { resolveAutomaticPromotion: async () => null },
    '../utils/orderHistory': { recordOrderStatus: async () => {} },
    './orderDeadline.service': { scheduleOrderDeadline: () => {} },
    '../models/order.model': { Order: { insertMany: async values => { writes.push(...values); return values; } } },
  });
  return { create: (input, draft, save) => OrderService.createOrder({ ...args, customerId: userId, ...input }, undefined, draft, save),
    writes, savedAddresses, deny: () => { owned = false; } };
}

test('Tạo đơn lưu số riêng vào thông tin đơn, giữ nguyên sổ địa chỉ và số gốc của địa chỉ mới', async () => {
  const originalStartSession = mongoose.startSession;
  mongoose.startSession = async () => ({ withTransaction: async work => work(), endSession: async () => {} });
  try {
    const runtime = orderFixture();
    const order = await runtime.create({ recipientPhone: '098 765 4321' });
    assert.equal(order.addressSnapshot.recipientPhone, '0987654321');
    assert.equal(String(order.addressId), addressId);
    assert.equal(address.recipientPhone, '0912345678');
    assert.equal(runtime.savedAddresses.length, 0);
    assert.equal((await runtime.create({})).addressSnapshot.recipientPhone, '0912345678');
    const draft = { ...address, validate: async () => {}, toObject() { return { ...address }; } };
    const temporaryOrder = await runtime.create({ recipientPhone: '0901234567' }, draft, false);
    assert.equal(temporaryOrder.addressId, null);
    assert.equal(temporaryOrder.addressSnapshot.recipientPhone, '0901234567');
    assert.equal(runtime.savedAddresses.length, 0);
    const savedOrder = await runtime.create({ recipientPhone: '0901234567' }, draft, true);
    assert.equal(savedOrder.addressSnapshot.recipientPhone, '0901234567');
    assert.equal(runtime.savedAddresses[0].recipientPhone, '0912345678');
  } finally { mongoose.startSession = originalStartSession; }
});

test('Số không hợp lệ, địa chỉ không thuộc khách hoặc địa chỉ thay đổi sau xác nhận không được ghi đơn', async () => {
  const runtime = orderFixture();
  await assert.rejects(runtime.create({ recipientPhone: '123' }), /Số điện thoại Việt Nam không hợp lệ/);
  await assert.rejects(runtime.create({ recipientPhone: '0987654321',
    confirmedExpectation: { amount: 100000, addressVersion: 'đã cũ' } }));
  runtime.deny();
  await assert.rejects(runtime.create({ recipientPhone: '0987654321' }), /Địa chỉ không hợp lệ/);
  assert.equal(runtime.writes.length, 0);
});
