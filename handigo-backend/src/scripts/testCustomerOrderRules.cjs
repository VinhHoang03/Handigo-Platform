const assert = require('node:assert/strict');
const { mock } = require('node:test');
const mongoose = require('mongoose');
const { Types } = mongoose;

// Kiểm thử cô lập; không đọc cấu hình bí mật, không kết nối database.
const stub = (path, exports) => { require.cache[require.resolve(path)] = { exports }; };
stub('../services/systemConfig.service', {
  getBookingPolicy: async () => require('../validations/bookingPolicy.validator').DEFAULT_BOOKING_POLICY,
  getNumberConfigValue: async () => 0,
});
stub('../services/serviceImage.service', { validateNewServiceImages: async () => {} });
stub('../services/reverseGeocoding.service', { geocodeSavedAddress: async () => ({ latitude: 10, longitude: 106 }) });
stub('../configs/payos.config', { payos: {} });
stub('../services/wallet.service', {});
stub('../services/notification.service', { createNotificationRecord: async () => {} });
stub('../services/dispatch.service', { DispatchService: { dispatchReadyOrder: async () => {} } });
const { Service } = require('../models/service.model');
const { ServiceOption } = require('../models/serviceOption.model');
const { Category } = require('../models/category.model');
const { Promotion } = require('../models/promotion.model');
const { Order } = require('../models/order.model');
const { OrderStatus } = require('../models/orderStatus.model');
const { Payment } = require('../models/payment.model');
const { VoucherUsage } = require('../models/voucherUsage.model');
const { Address } = require('../models/address.model');
const User = require('../models/user.model').default;
const { createAddress, deleteAddress, updateAddress, getUserAddresses } = require('../services/address.service');
const { validateOptionSelection } = require('../utils/serviceOptionGroups');
const { withOrderAddress } = require('../utils/orderAddress');
const { createPromotionSchema } = require('../validations/promotion.validator');

let voucher;
let usages = [];
const query = value => ({ session() { return this; }, select() { return this; }, sort() { return this; }, limit() { return this; }, lean: async () => value, then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) });
stub('../services/voucherStore.service', {
  findStoredVoucher: async filter => filter.ownerId ? null : voucher,
  listStoredVouchers: async () => [],
  updateStoredVoucher: async (_id, filter, update) => {
    if (filter.reservedCount && !voucher.reservedCount) return { modifiedCount: 0 };
    if (filter.reservedOrderId && !voucher.reservedOrderId?.equals(filter.reservedOrderId)) return { modifiedCount: 0 };
    for (const [key, amount] of Object.entries(update.$inc ?? {})) voucher[key] = (voucher[key] ?? 0) + amount;
    Object.assign(voucher, update.$set ?? {});
    return { modifiedCount: 1 };
  },
});
const { reservePersonalVoucher, releaseVoucherReservation, markOrderVoucherAsUsed } = require('../services/voucher.service');
const { buildServicePricingSnapshot, previewServiceBooking } = require('../services/servicePricing.service');
const { updateService } = require('../services/service.service');
const { promotionDiscount, resolveAutomaticPromotion, claimPromotion } = require('../services/promotion.service');
const { installOrderHistory } = require('../utils/orderHistory');
const { orderActorContext } = require('../utils/orderActorContext');
const { createPayment } = require('../services/payment.service');

const groupA = new Types.ObjectId(), groupB = new Types.ObjectId();
const groups = [
  { _id: groupA, name: 'Loại máy', selectionMode: 'single', isRequired: true, sortOrder: 0 },
  { _id: groupB, name: 'Công việc', selectionMode: 'multiple', isRequired: true, sortOrder: 1 },
];
const service = new Service({ categoryId: new Types.ObjectId(), name: 'Máy lạnh', slug: 'may-lanh', serviceType: 'fixed_price', fixedPrice: 123456, optionGroups: groups });
const options = [groupA, groupA, groupB, groupB].map((groupId, index) => new ServiceOption({
  serviceId: service._id, groupId, name: `Tùy chọn ${index}`, optionType: 'other', price: 100000 + index * 10000, allowsQuantity: true,
}));
const ids = indexes => new Set(indexes.map(index => options[index]._id.toString()));

async function testGroupsAndPrices() {
  for (const indexes of [[], [0], [2], [0, 1, 2]]) assert.throws(() => validateOptionSelection(service, options, ids(indexes)));
  for (const indexes of [[0, 2], [1, 2, 3]]) validateOptionSelection(service, options, ids(indexes));
  validateOptionSelection({ optionGroups: groups.map(group => ({ ...group, isRequired: false })), requiresOptionSelection: true }, options, ids([]));
  mock.method(ServiceOption, 'find', () => query(options));
  mock.method(Service, 'findOne', async () => service);
  mock.method(Service, 'exists', async () => false);
  mock.method(Category, 'findOne', async () => ({ isActive: true }));
  mock.method(service, 'save', async () => service);
  await assert.rejects(buildServicePricingSnapshot(service, [], []), /Công việc|Loại máy/);
  await assert.rejects(buildServicePricingSnapshot(service, [], [{ optionId: new Types.ObjectId().toString(), quantity: 1 }]), /Loại máy/);
  const selected = [0, 2].map(index => ({ optionId: options[index]._id.toString(), quantity: index === 0 ? 2 : 1 }));
  const priced = await buildServicePricingSnapshot(service, [], selected);
  assert.equal(priced.bookingAmount, 320000);
  await assert.rejects(buildServicePricingSnapshot(service, [], [...selected, selected[0]]), /trùng/);
  await assert.rejects(buildServicePricingSnapshot(service, [], selected.map(item => ({ ...item, quantity: 100 }))), /Số lượng/);
  const before = { price: service.fixedPrice, options: options.map(option => option.price), type: service.serviceType };
  await updateService(service._id.toString(), { optionGroups: groups.map(group => ({ ...group, name: `${group.name} mới` })) });
  assert.equal(service.fixedPrice, before.price);
  assert.equal(service.serviceType, before.type);
  assert.deepEqual(options.map(option => option.price), before.options);
  await assert.rejects(updateService(service._id.toString(), { optionGroups: [] }), /chuyển/);
  mock.restoreAll();
}

async function testPromotions() {
  assert.equal(promotionDiscount({ discountType: 'PERCENT', discountValue: 20, maxDiscountAmount: 30000 }, 200000), 30000);
  assert.equal(promotionDiscount({ discountType: 'AMOUNT', discountValue: 900000 }, 200000), 200000);
  assert.equal(promotionDiscount({ discountType: 'percentage', discountValue: 15 }, 99999), 14999);
  const config = { name: 'Ưu đãi', discountType: 'PERCENT', discountValue: 20, startAt: '2026-01-01T00:00:00Z', endAt: '2027-01-01T00:00:00Z' };
  assert.equal(createPromotionSchema.parse(config).allowVoucher, false);
  assert.equal(createPromotionSchema.safeParse({ ...config, discountValue: 101 }).success, false);
  assert.equal(createPromotionSchema.safeParse({ ...config, startAt: config.endAt }).success, false);
  const promotion = new Promotion({ ...config, applicationMode: 'automatic', updatedAt: new Date(), minOrderAmount: 100000 });
  let filter;
  mock.method(Promotion, 'find', input => { filter = input; return query([promotion]); });
  const resolved = await resolveAutomaticPromotion(service._id, 200000, true);
  assert.equal(filter.allowVoucher, true);
  assert.equal(filter.applicationMode, 'automatic');
  assert.equal(resolved.discountAmount, 40000);
  assert.equal(await resolveAutomaticPromotion(service._id, 99999, false), null);
  mock.method(Promotion, 'updateOne', async () => ({ modifiedCount: 0 }));
  await assert.rejects(claimPromotion(promotion, 3, {}), /hết lượt/);
  mock.restoreAll();
}

async function testVoucherReservation() {
  voucher = { _id: new Types.ObjectId(), code: 'TEST', ownerId: null, isActive: true, isDeleted: false, status: 'ACTIVE', usedCount: 0, reservedCount: 0, usageLimit: 1, perUserLimit: 2,
    startAt: new Date('2020-01-01'), endAt: new Date('2100-01-01'), save: async () => {} };
  const customer = new Types.ObjectId().toString(), first = new Types.ObjectId(), second = new Types.ObjectId();
  mock.method(VoucherUsage, 'exists', filter => query(usages.find(item => item.orderId.equals(filter.orderId) && item.status === filter.status)));
  mock.method(VoucherUsage, 'countDocuments', () => query(usages.filter(item => item.status !== 'restored').length));
  mock.method(VoucherUsage, 'create', async documents => { usages.push(...documents); return documents; });
  mock.method(VoucherUsage, 'findOneAndUpdate', (filter, update) => {
    const item = usages.find(item => item.orderId.equals(filter.orderId) && item.status === filter.status);
    if (item) Object.assign(item, update.$set);
    return query(item ?? null);
  });
  await reservePersonalVoucher(voucher._id, customer, first, false, {});
  assert.equal(voucher.reservedCount, 1);
  await reservePersonalVoucher(voucher._id, customer, first, false, {});
  assert.equal(usages.length, 1);
  await assert.rejects(reservePersonalVoucher(voucher._id, customer, second, false, {}), /hết lượt/);
  await releaseVoucherReservation(first, {});
  await releaseVoucherReservation(first, {});
  assert.equal(voucher.reservedCount, 0);
  await reservePersonalVoucher(voucher._id, customer, second, false, {});
  const order = { _id: second, customerId: new Types.ObjectId(customer), voucherSnapshot: { voucherId: voucher._id }, pricing: { voucherDiscountAmount: 20000 } };
  mock.method(Order, 'findOneAndUpdate', async () => order);
  await markOrderVoucherAsUsed(order, {});
  assert.equal(voucher.usedCount, 1);
  assert.equal(voucher.reservedCount, 0);
  assert.equal(usages[1].discountAmount, 20000);
  await markOrderVoucherAsUsed(order, {});
  assert.equal(voucher.usedCount, 1);
  mock.restoreAll();
}

async function testHistory() {
  const hooks = { pre: {}, post: {} };
  installOrderHistory({ pre(name, fn) { hooks.pre[name] = fn; }, post(name, fn) { if (fn.length < 3) hooks.post[name] = fn; } });
  const events = [];
  mock.method(OrderStatus, 'updateOne', async (filter, update, options) => { events.push({ filter, update, options }); });
  let commits = 0, aborts = 0, endings = 0;
  const session = { startTransaction() {}, inTransaction: () => true, commitTransaction: async () => { commits++; }, abortTransaction: async () => { aborts++; }, endSession: async () => { endings++; } };
  mock.method(mongoose, 'startSession', async () => session);
  const before = { _id: new Types.ObjectId(), status: 'created', statusVersion: 2 };
  let update = { $set: { status: 'accepted' } };
  let conditions = { _id: before._id };
  const context = { model: { find: () => query([before]) }, getUpdate: () => update, getOptions: () => ({}), session() {}, getFilter: () => conditions,
    setQuery(value) { conditions = value; }, setUpdate(value) { update = value; }, setOptions() {} };
  await orderActorContext.run({ id: new Types.ObjectId().toString(), role: 'customer' }, async () => {
    await hooks.pre.findOneAndUpdate.call(context);
    await hooks.post.findOneAndUpdate.call(context, { _id: before._id });
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].filter.statusVersion, 3);
  assert.equal(events[0].update.$setOnInsert.previousStatus, 'created');
  assert.equal(events[0].update.$setOnInsert.changedByRole, 'customer');
  assert.equal(events[0].options.session, session);
  assert.equal(commits, 1);
  assert.equal(endings, 1);
  update = { $set: { status: 'created' } };
  await hooks.pre.updateOne.call(context);
  await hooks.post.updateOne.call(context, { modifiedCount: 1 });
  assert.equal(events.length, 1);
  assert.equal(update.$inc, undefined);
  mock.method(OrderStatus, 'updateOne', async () => { throw new Error('Không ghi được lịch sử'); });
  update = { $set: { status: 'completed' } };
  await hooks.pre.updateOne.call(context);
  await assert.rejects(hooks.post.updateOne.call(context, { modifiedCount: 1 }), /lịch sử/);
  assert.equal(aborts, 1);
  mock.method(OrderStatus, 'updateOne', async () => {});
  mock.method(session, 'commitTransaction', async () => { throw new Error('Không commit được transaction'); });
  await hooks.pre.updateOne.call(context);
  await assert.rejects(hooks.post.updateOne.call(context, { modifiedCount: 1 }), /commit/);
  assert.equal(aborts, 2);
  mock.restoreAll();
}

async function testAddresses() {
  const owner = new Types.ObjectId(), stranger = new Types.ObjectId();
  const data = { recipientName: 'Nguyễn An', recipientPhone: '0901234567', fullAddress: '12 Nguyễn Huệ', province: 'Hồ Chí Minh', ward: 'Bến Nghé', latitude: 10, longitude: 106 };
  const stored = new Address({ ...data, userId: owner, isDeleted: true, updatedAt: new Date(), createdAt: new Date() });
  const records = [stored];
  const owned = (item, filter) => item.userId.equals(filter.userId) && (!filter._id || item._id.equals(filter._id))
    && (!filter.isDeleted || typeof filter.isDeleted === 'object' ? !filter.isDeleted || item.isDeleted !== true : item.isDeleted === filter.isDeleted);
  mock.method(mongoose.connection, 'transaction', async work => work({}));
  mock.method(User, 'updateOne', async () => ({ matchedCount: 1 }));
  mock.method(User, 'findById', () => query({ fullName: 'Nguyễn An', phone: '0901234567' }));
  mock.method(Address, 'find', filter => query(records.filter(item => owned(item, filter)).map(item => item.toObject())));
  mock.method(Address, 'findOne', filter => query(records.find(item => owned(item, filter))));
  mock.method(Address, 'findOneAndUpdate', (filter, update, options) => {
    assert.equal(options.runValidators, true);
    const item = records.find(item => owned(item, filter));
    if (item) { Object.assign(item, update.$set); item.updatedAt = new Date(); }
    return query(item ?? null);
  });
  mock.method(Address, 'updateMany', async () => ({ modifiedCount: 0 }));
  mock.method(Address, 'create', async documents => { const rows = documents.map(item => new Address(item)); records.push(...rows); return rows; });
  assert.equal((await getUserAddresses(owner.toString())).length, 0);
  const restored = await createAddress(owner.toString(), data);
  assert.equal(restored._id.toString(), stored._id.toString());
  assert.equal(records.length, 1);
  assert.equal(restored.isDeleted, false);
  await assert.rejects(deleteAddress(stored._id.toString(), stranger.toString()), /Không tìm thấy/);
  const oldKey = restored.identityKey;
  await updateAddress(stored._id.toString(), owner.toString(), { fullAddress: '14 Nguyễn Huệ', latitude: 10, longitude: 106 });
  assert.notEqual(restored.identityKey, oldKey);
  await deleteAddress(stored._id.toString(), owner.toString());
  assert.equal((await getUserAddresses(owner.toString())).length, 0);
  assert.equal(records.length, 1);
  stored.placeId = 'same-building';
  const otherApartment = await createAddress(owner.toString(), { ...data, fullAddress: 'Căn 203, 14 Nguyễn Huệ', placeId: 'same-building' });
  assert.notEqual(otherApartment._id.toString(), stored._id.toString());
  assert.equal(stored.isDeleted, true);
  mock.restoreAll();
}

async function testFullyDiscountedPayment() {
  const customerId = new Types.ObjectId();
  const order = { _id: new Types.ObjectId(), customerId, status: 'created', orderType: 'normal', paymentStatus: 'unpaid', inspectionRequired: false,
    pricing: { bookingAmount: 100000, totalPaidAmount: 0, baseAmount: 100000, promotionDiscountAmount: 100000 }, save: async () => {} };
  mock.method(mongoose.connection, 'transaction', async work => work({}));
  mock.method(Order, 'findById', () => query(order));
  mock.method(Payment, 'findOne', () => query(null));
  mock.method(Payment, 'create', async documents => documents.map(document => ({ ...document, _id: new Types.ObjectId() })));
  mock.method(Payment, 'aggregate', () => query([{ total: 0 }]));
  for (const method of ['PAYOS', 'WALLET', 'CASH']) {
    order.paymentStatus = 'unpaid';
    const result = await createPayment({ id: customerId.toString(), role: 'CUSTOMER' }, { orderId: order._id.toString(), method, paymentType: 'FULL' });
    assert.equal(result.payment.amount, 0);
    assert.equal(result.payment.status, 'paid');
    assert.equal(result.checkoutUrl, undefined);
    assert.equal(order.paymentStatus, 'paid');
    assert.equal(order.paymentMethod, method === 'PAYOS' ? 'bank' : method.toLowerCase());
    assert.equal(order.readyForMatching, true);
  }
  await assert.rejects(createPayment({ id: new Types.ObjectId().toString(), role: 'CUSTOMER' }, { orderId: order._id.toString(), method: 'PAYOS' }), /quyền/);
  mock.restoreAll();
}

(async () => {
  assert.equal(mongoose.connection.readyState, 0);
  await testGroupsAndPrices();
  await testPromotions();
  await testVoucherReservation();
  await testHistory();
  await testAddresses();
  await testFullyDiscountedPayment();
  const addressId = new Types.ObjectId();
  const result = withOrderAddress({ addressId: { _id: addressId, fullAddress: 'Địa chỉ đã sửa' }, addressSnapshot: { fullAddress: 'Địa chỉ khi đặt' } });
  assert.equal(result.addressId.fullAddress, 'Địa chỉ khi đặt');
  assert.equal(result.addressId._id, addressId);
  assert.equal(mongoose.connection.readyState, 0);
  console.log('Đạt kiểm thử nhóm tùy chọn, giữ giá, ưu đãi, giữ lượt voucher, lịch sử trạng thái và địa chỉ đơn.');
})().catch(error => { mock.restoreAll(); console.error(error); process.exitCode = 1; });
