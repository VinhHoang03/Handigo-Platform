import assert from "node:assert/strict";
import { mock } from "node:test";
import mongoose, { Types } from "mongoose";
import { Order } from "../models/order.model";
import { OrderAssignment } from "../models/orderAssignment.model";
import { Provider } from "../models/provider.model";
import { Payment } from "../models/payment.model";
import { Address } from "../models/address.model";
import { Service } from "../models/service.model";
import { ServiceOption } from "../models/serviceOption.model";
import { Category } from "../models/category.model";
import { DEFAULT_BOOKING_POLICY } from "../validations/bookingPolicy.validator";
import { calculateDuration } from "../utils/bookingPolicy";
import { updateProviderProfileSchema } from "../validations/providerProfile.validator";

// Cô lập dịch vụ ngoài để kiểm thử không đọc cấu hình bí mật hoặc kết nối database.
function stubModule(path: string, exports: object) {
  require.cache[require.resolve(path)] = { exports } as NodeModule;
}

const notifications: Array<{ userId: unknown }> = [];
const schedule = {
  lockProviderSchedule: async () => provider,
  assertProviderSchedule: async () => {},
};
stubModule("../services/systemConfig.service", {
  getBookingPolicy: async () => DEFAULT_BOOKING_POLICY,
  getNumberConfigValue: async (key: string) => key === "PLATFORM_FEE_PERCENT" ? 15 : 40000,
});
stubModule("../sockets/socketServer", { emitToUser: () => {} });
stubModule("../services/notification.service", {
  createNotificationRecord: async (input: { userId: unknown }) => { notifications.push(input); },
});
stubModule("../services/orderCancellation.service", {});
stubModule("../services/orderReassignment.service", {});
stubModule("../services/quotationRelevance.service", {});
stubModule("../services/providerWalletEligibility.service", { assertProviderWalletEligible: async () => {} });
stubModule("../services/providerSchedule.service", schedule);
stubModule("../services/reward.service", {});
stubModule("../services/wallet.service", {});
stubModule("../services/dispatch.service", {});
stubModule("../services/address.service", { ensureAddressCoordinates: async (address: unknown) => address });
stubModule("../services/matching.service", {
  MatchingService: { findNearestProviders: async () => [{ providerId: provider._id, userId: provider.userId }] },
});
stubModule("../services/voucher.service", {
  resolveVoucherForAmount: async () => ({ discountAmount: 10000, snapshot: null }),
});

const { buildServicePricingSnapshot, previewServiceBooking } = require("../services/servicePricing.service") as typeof import("../services/servicePricing.service");
const { AssignmentService } = require("../services/assignment.service") as typeof import("../services/assignment.service");
const { OrderService } = require("../services/order.service") as typeof import("../services/order.service");
const provider = new Provider({ _id: new Types.ObjectId(), userId: new Types.ObjectId() });
const service = new Service({ name: "Dịch vụ kiểm thử", slug: "dich-vu-kiem-thu", serviceType: "fixed_price" });
const option = new ServiceOption({
  _id: new Types.ObjectId(), name: "Gói kiểm thử", price: 100000,
  optionType: "package", allowsQuantity: true,
});

async function testPricing() {
  mock.method(ServiceOption, "find", () => ({ sort: async () => [option] }));
  mock.method(Service, "findOne", async () => service);
  const selectedOptions = [{ optionId: option._id.toString(), quantity: 2 }];
  const immediate = await buildServicePricingSnapshot(service, [], selectedOptions);
  assert.equal(immediate.baseAmount, 200000);
  assert.equal(immediate.bookingAmount, 200000);
  assert.equal(immediate.immediateFee, 0);
  assert.equal(immediate.selectedOptionsSnapshot[0].quantity, 2);
  for (const orderType of ["normal", "urgent", "scheduled", "recurring"]) {
    const booked = await buildServicePricingSnapshot(service, [], selectedOptions, undefined, orderType);
    const preview = await previewServiceBooking({ serviceId: service._id.toString(), selectedOptions, orderType });
    assert.equal(booked.bookingAmount, 200000);
    assert.equal(preview.bookingAmount, booked.bookingAmount);
    assert.equal(booked.immediateFee, 0);
    assert.equal(booked.schedule.durationMinutes, DEFAULT_BOOKING_POLICY.defaultDurationMinutes);
  }
  await assert.rejects(buildServicePricingSnapshot(service, [], [selectedOptions[0], selectedOptions[0]]));
  await assert.rejects(buildServicePricingSnapshot(service, [], [{ ...selectedOptions[0], quantity: 0 }]));

  const cleaning = new Service({ name: "Vệ sinh điều hòa", slug: "ve-sinh-dieu-hoa", serviceType: "fixed_price", fixedPrice: 100000 });
  const uniform = await buildServicePricingSnapshot(cleaning, [], [], 3, "scheduled");
  assert.equal(uniform.bookingAmount, 300000);
  assert.equal(uniform.baseAmount, 300000);
  assert.equal(uniform.selectedOptionsSnapshot[0].optionId, null);
  assert.equal(uniform.selectedOptionsSnapshot[0].quantity, 3);
  assert.equal(calculateDuration(cleaning._id.toString(), false, uniform.selectedOptionsSnapshot, DEFAULT_BOOKING_POLICY), 60);
  const uniformNow = await buildServicePricingSnapshot(cleaning, [], [], 3, "normal");
  assert.equal(uniformNow.bookingAmount, 300000);
  assert.equal(uniformNow.immediateFee, 0);
  await assert.rejects(buildServicePricingSnapshot(cleaning, [], [], 0));

  const repair = new Service({ name: "Sửa chữa", serviceType: "variable_price", depositAmount: 40000 });
  const deposit = await buildServicePricingSnapshot(repair, [], selectedOptions);
  assert.equal(deposit.depositAmount, 40000);
  assert.equal(deposit.baseAmount, 40000);
  assert.equal(deposit.bookingAmount, 40000);
  assert.equal(deposit.immediateFee, 0);
  assert.equal(deposit.selectedOptionsSnapshot[0].price, 0);
  mock.restoreAll();
}

async function testAssignments() {
  const order = new Order({
    _id: new Types.ObjectId(), customerId: new Types.ObjectId(), serviceId: service._id,
    orderCode: "KIEM-THU", status: "created", paymentStatus: "paid", paymentMethod: "wallet",
    selectedOptionsSnapshot: [], inspectionRequired: false,
  });
  const assignment = new OrderAssignment({
    _id: new Types.ObjectId(), orderId: order._id, providerId: provider._id,
    status: "pending", responseDeadline: new Date(Date.now() + 60000), assignmentType: "dispatch",
  });
  let ended = 0;
  let saved = 0;
  let claimed = 0;
  let active = false;
  const session = {
    withTransaction: async (fn: () => Promise<unknown>) => {
      active = true;
      try { return await fn(); } finally { active = false; }
    },
    endSession: async () => { ended += 1; },
  };
  mock.method(mongoose, "startSession", async () => session);
  mock.method(Provider, "findOne", async () => provider);
  mock.method(OrderAssignment, "findOne", async () => assignment);
  mock.method(Order, "findById", () => ({ select: async () => order }));
  mock.method(Address, "findById", () => ({ select: async () => ({ ward: "Phường kiểm thử" }) }));
  mock.method(Order, "findOne", () => ({ session: async () => order }));
  mock.method(OrderAssignment, "find", () => ({ select: () => ({ lean: async () => [] }) }));
  mock.method(OrderAssignment, "findOneAndUpdate", async () => {
    claimed += 1;
    return assignment;
  });
  mock.method(order, "save", async () => { saved += 1; return order; });
  mock.method(provider, "save", async () => provider);
  const scheduleCheck = mock.method(schedule, "assertProviderSchedule", async () => { assert.equal(active, true); });
  const accepted = await AssignmentService.acceptAssignment(assignment._id.toString(), provider.userId.toString());
  assert.equal(accepted.order.status, "accepted");
  assert.equal(accepted.order.providerId?.toString(), provider._id.toString());
  assert.equal(accepted.order.readyForMatching, false);
  assert.equal(provider.availabilityStatus, "busy");
  assert.equal(saved, 1);
  assert.equal(ended, 1);
  assert.equal(notifications.length, 1);

  assignment.providerId = new Types.ObjectId();
  await assert.rejects(AssignmentService.acceptAssignment(assignment._id.toString(), provider.userId.toString()), /quyền/);
  assignment.providerId = provider._id as Types.ObjectId;
  assignment.responseDeadline = new Date(0);
  await assert.rejects(AssignmentService.acceptAssignment(assignment._id.toString(), provider.userId.toString()), /hết hạn/);
  assignment.responseDeadline = new Date(Date.now() + 60000);
  order.paymentStatus = "unpaid";
  await assert.rejects(AssignmentService.acceptAssignment(assignment._id.toString(), provider.userId.toString()), /thanh toán/);
  assert.equal(saved, 1);
  assert.equal(ended, 2);

  order.paymentMethod = "cash";
  assignment.assignmentType = "direct_request";
  mock.method(Payment, "exists", () => ({ session: async () => ({ _id: new Types.ObjectId() }) }));
  await AssignmentService.acceptAssignment(assignment._id.toString(), provider.userId.toString());
  assert.equal(saved, 2);
  const claimsBeforeConflict = claimed;
  scheduleCheck.mock.mockImplementation(async () => { throw new Error("Trùng lịch kiểm thử"); });
  await assert.rejects(AssignmentService.acceptAssignment(assignment._id.toString(), provider.userId.toString()), /Trùng lịch/);
  assert.equal(saved, 2);
  assert.equal(claimed, claimsBeforeConflict);
  assert.equal(ended, 4);

  // Nhánh lịch hẹn và chuỗi lịch vẫn cập nhật đơn chính và các buổi còn lại.
  assignment.assignmentType = "appointment";
  order.status = "created";
  order.paymentStatus = "paid";
  order.scheduledAt = new Date(Date.now() + 2 * 86400000);
  order.recurringGroupId = new Types.ObjectId();
  let relatedUpdated = false;
  mock.method(Order, "find", () => ({ select: async () => [order] }));
  mock.method(Order, "exists", async () => null);
  mock.method(Order, "findOneAndUpdate", async (_filter: unknown, update: { $set: object }) => {
    Object.assign(order, update.$set);
    return order;
  });
  mock.method(Order, "updateMany", async (_filter: unknown, update: { $set: { bookingStatus: string } }) => {
    assert.equal(update.$set.bookingStatus, "reserved");
    relatedUpdated = true;
  });
  const appointment = await AssignmentService.acceptAssignment(assignment._id.toString(), provider.userId.toString());
  assert.equal(appointment.order.status, "accepted");
  assert.equal(appointment.order.bookingStatus, "confirmed");
  assert.equal(relatedUpdated, true);
  mock.restoreAll();
}

async function testOrderCreation() {
  const address = new Address({ _id: new Types.ObjectId(), latitude: 10, longitude: 106 });
  const payload = {
    customerId: new Types.ObjectId().toString(), serviceId: service._id.toString(),
    addressId: address._id.toString(), paymentMethod: "wallet" as const,
    selectedOptions: [{ optionId: option._id.toString(), quantity: 2 }],
  };
  let created: InstanceType<typeof Order>[] = [];
  mock.method(Service, "findOne", async () => service);
  mock.method(ServiceOption, "find", () => ({ sort: async () => [option] }));
  mock.method(Category, "exists", async () => ({ _id: new Types.ObjectId() }));
  mock.method(Address, "findOne", async () => address);
  mock.method(Order, "insertMany", async (documents: object[]) => {
    created = documents.map((document) => new Order(document));
    for (const order of created) mock.method(order, "save", async () => order);
    return created;
  });
  const immediate = await OrderService.createOrder({ ...payload, expectedBookingAmount: 200000 });
  assert.equal(created.length, 1);
  assert.equal(immediate.pricing.bookingAmount, 200000);
  assert.equal(immediate.pricing.platformCommissionAmount, 30000);
  assert.equal(immediate.pricing.providerEarningAmount, 170000);
  assert.equal(immediate.pricing.immediateFee, 0);
  assert.equal(immediate.schedule?.durationMinutes, 60);
  await assert.rejects(OrderService.createOrder({ ...payload, expectedBookingAmount: 1 }), /Giá vừa thay đổi/);
  await assert.rejects(OrderService.createOrder({ ...payload, expectedBookingAmount: 230000 }), /Giá vừa thay đổi/);
  const discounted = await OrderService.createOrder({ ...payload, voucherCode: "KIEM-THU" });
  assert.equal(discounted.pricing.totalPaidAmount, 190000);
  assert.equal(discounted.pricing.immediateFee, 0);
  assert.equal(discounted.pricing.platformCommissionAmount + discounted.pricing.providerEarningAmount, 190000);

  const scheduledAt = new Date(Date.now() + 2 * 86400000);
  await OrderService.createOrder({
    ...payload, orderType: "recurring", scheduledAt,
    recurrenceUnit: "weekly", recurrenceCount: 3, voucherCode: "KIEM-THU",
  });
  assert.equal(created.length, 3);
  assert.equal(created[0].pricing.bookingAmount, 200000);
  assert.equal(created[0].pricing.totalPaidAmount, 190000);
  assert.equal(created[1].pricing.totalPaidAmount, 200000);
  assert.equal(created[1].bookingStatus, "reserved");
  assert.equal(created[2].recurringGroupId?.toString(), created[0].recurringGroupId?.toString());
  assert.equal(created[0].pricing.immediateFee, 0);
  assert.equal(created[0].pricing.platformCommissionAmount + created[0].pricing.providerEarningAmount, 190000);

  provider.autoAcceptScheduledBookings = true;
  provider.autoAcceptScheduledBookingHorizonDays = 7;
  mock.method(Provider, "findById", () => ({ select: async () => provider }));
  mock.method(Order, "exists", async () => null);
  mock.method(mongoose, "startSession", async () => ({
    withTransaction: async (fn: () => Promise<unknown>) => fn(), endSession: async () => {},
  }));
  const reserved = await OrderService.createOrder({
    ...payload, orderType: "scheduled", scheduledAt, preferredProviderId: provider._id.toString(),
  });
  assert.equal(reserved.status, "created");
  assert.equal(reserved.providerId, null);
  assert.equal(reserved.paymentDueAt, null);
  assert.equal(reserved.preferredProviderId?.toString(), provider._id.toString());
  await OrderService.createOrder({
    ...payload, orderType: "recurring", scheduledAt, preferredProviderId: provider._id.toString(),
    recurrenceUnit: "weekly", recurrenceCount: 3,
  });
  assert.equal(created.length, 3);
  for (const order of created) {
    assert.equal(order.status, "created");
    assert.equal(order.providerId, null);
    assert.equal(order.paymentDueAt, null);
  }
  provider.autoAcceptScheduledBookings = false;
  const pending = await OrderService.createOrder({
    ...payload, orderType: "scheduled", scheduledAt, preferredProviderId: provider._id.toString(),
  });
  assert.equal(pending.status, "created");
  mock.restoreAll();
}

async function run() {
  assert.deepEqual(updateProviderProfileSchema.parse({
    autoAcceptScheduledBookings: true,
    autoAcceptScheduledBookingHorizonDays: 7,
    autoAcceptScheduledBookingMinAdvanceMinutes: 60,
  }), {});
  await testPricing();
  await testAssignments();
  await testOrderCreation();
  console.log("Đã kiểm tra tính giá, tiền cọc, nhận đơn thủ công, quyền, thanh toán, xung đột lịch, tạo đơn, voucher và lịch mới không tự nhận dù hồ sơ cũ đã bật.");
}
run().catch((error) => { mock.restoreAll(); console.error(error); process.exitCode = 1; });
