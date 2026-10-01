import assert from "node:assert/strict";
import { mock } from "node:test";
import mongoose, { Types } from "mongoose";
import { Order } from "../models/order.model";
import { Provider } from "../models/provider.model";
import { Payment } from "../models/payment.model";
import { OrderAssignment } from "../models/orderAssignment.model";
import { RepairQuotation } from "../models/repairQuotation.model";
import { RepairQuotationItem } from "../models/repairQuotationItem.model";
import { Service } from "../models/service.model";
import { Wallet } from "../models/wallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { QUOTATION_REJECTION_REASON, isQuotationRejectionReason } from "../services/refundPolicy.service";

// Cô lập cấu hình và dịch vụ ngoài; không đọc bí mật hoặc truy cập database.
function stubModule(path: string, exports: object) {
  require.cache[require.resolve(path)] = { exports } as NodeModule;
}
stubModule("../configs/payos.config", { payos: {}, payoutPayos: {} });
stubModule("../services/notification.service", { createNotificationRecord: async () => {} });
stubModule("../sockets/socketServer", { emitToUser: () => {} });
stubModule("../services/systemConfig.service", {});
stubModule("../services/orderReassignment.service", {
  requestProviderReassignment: () => { throw new Error("Không được tìm thợ thay thế khi khách từ chối báo giá."); },
});
stubModule("../services/providerSchedule.service", {});
stubModule("../services/providerWalletEligibility.service", {});
stubModule("../services/quotationRelevance.service", {
  evaluateQuotationItemsForOrder: async () => ({ status: "valid" }),
  getBlockedRelevanceItems: () => [],
});
stubModule("../services/reward.service", {});
stubModule("../services/wallet.service", {});
stubModule("../services/dispatch.service", {});
stubModule("../services/address.service", {});
stubModule("../services/matching.service", {});
stubModule("../services/voucher.service", {});
const { OrderService } = require("../services/order.service") as typeof import("../services/order.service");
const { AssignmentService } = require("../services/assignment.service") as typeof import("../services/assignment.service");

// Query giả vẫn hỗ trợ await, select và session như Mongoose.
function query(value: unknown): any {
  return { then: (resolve: (value: unknown) => unknown) => Promise.resolve(value).then(resolve),
    session: () => query(value), select: () => query(value), lean: () => query(value) };
}

async function testCancellation(method: string, fee = 0, invalid?: string) {
  const provider = { _id: new Types.ObjectId(), userId: new Types.ObjectId() };
  const order: any = { _id: new Types.ObjectId(), customerId: new Types.ObjectId(),
    providerId: provider._id, currentQuotationId: new Types.ObjectId(), orderCode: "KIEM-THU",
    status: "accepted", orderType: "normal", inspectionRequired: true, depositAmount: 40000 };
  const payment: any = { _id: new Types.ObjectId(), orderId: order._id, customerId: order.customerId,
    method, status: "paid", paymentType: "inspection_deposit", amount: 40000 + fee, compensatedToProviderId: null };
  const wallet = { _id: new Types.ObjectId(), balance: 100000, save: async (options: any) => { assert.ok(options.session); } };
  const customerWallet = { _id: new Types.ObjectId(), balance: 0 };
  const entries: any[] = [];
  if (invalid === "unpaid") payment.status = "pending";
  if (invalid === "completed") order.status = "completed";
  if (invalid === "in_progress") order.status = "in_progress";
  if (invalid === "ownership") order.providerId = new Types.ObjectId();
  const session = { withTransaction: async (callback: () => Promise<void>) => callback(), endSession: async () => {} };
  mock.method(mongoose, "startSession", async () => session);
  mock.method(Order, "findById", () => query(order));
  mock.method(Order, "findOneAndUpdate", (_filter: any, update: any, options: any) => {
    assert.equal(options.session, session);
    Object.assign(order, update.$set); return query(order);
  });
  mock.method(Order, "updateOne", async () => ({}));
  mock.method(OrderAssignment, "updateMany", async () => ({}));
  mock.method(Provider, "findOne", () => query(provider));
  mock.method(Provider, "findById", () => query(provider));
  mock.method(Provider, "updateOne", async () => ({}));
  mock.method(RepairQuotation, "findOne", () => query(invalid === "quotation" ? null : { _id: order.currentQuotationId }));
  const matches = (filter: any) => (!filter.method || filter.method === payment.method) &&
    (!filter.status || (typeof filter.status === "string" ? filter.status === payment.status : filter.status.$in.includes(payment.status))) &&
    (!("compensatedToProviderId" in filter) || payment.compensatedToProviderId === filter.compensatedToProviderId);
  mock.method(Payment, "find", (filter: any) => query(matches(filter) ? [payment] : []));
  mock.method(Payment, "findOne", (filter: any) => query(matches(filter) ? payment : null));
  mock.method(Payment, "exists", (filter: any) => query(matches(filter) ? { _id: payment._id } : null));
  mock.method(Payment, "findOneAndUpdate", (filter: any, update: any, options: any) => {
    assert.equal(options.session, session);
    if (!matches(filter)) return query(null);
    Object.assign(payment, update.$set); return query(payment);
  });
  mock.method(Payment, "updateMany", async () => ({}));
  mock.method(Wallet, "findOne", () => query(wallet));
  mock.method(Wallet, "findOneAndUpdate", (_filter: any, update: any, options: any) => {
    assert.equal(options.session, session);
    customerWallet.balance += update.$inc.balance; return query(customerWallet);
  });
  mock.method(WalletTransaction, "findOne", () => query(null));
  mock.method(WalletTransaction, "create", async (documents: any[], options: any) => {
    assert.equal(options.session, session); entries.push(...documents); return documents;
  });
  const cancel = () => OrderService.cancelOrder(order._id.toString(), provider.userId.toString(), "provider", `${QUOTATION_REJECTION_REASON}: Khách không sửa nữa`);
  if (invalid && invalid !== "in_progress") {
    await assert.rejects(cancel());
    assert.equal(wallet.balance, 100000);
    assert.equal(entries.length, 0);
  } else {
    await cancel();
    assert.equal(order.status, "cancelled");
    assert.equal(wallet.balance, 140000);
    assert.equal(customerWallet.balance, fee);
    assert.equal(order.cancellation.refundPolicy.providerCompensation, 40000);
    assert.equal(order.cancellation.refundPolicy.platformRetainedAmount, 0);
    assert.equal(entries.filter((entry) => entry.type === "provider_earning").length, 1);
    await cancel();
    assert.equal(wallet.balance, 140000);
    assert.equal(entries.filter((entry) => entry.type === "provider_earning").length, 1);
  }
  mock.restoreAll();
}

async function testQuotationAmount() {
  const provider = { _id: new Types.ObjectId(), userId: new Types.ObjectId() };
  const order: any = { _id: new Types.ObjectId(), providerId: provider._id, inspectionRequired: true,
    depositAmount: 40000, status: "accepted", confirmation: {}, save: async () => {} };
  mock.method(Order, "findById", () => query(order));
  mock.method(Provider, "findOne", () => query(provider));
  mock.method(Service, "findById", () => query({ serviceType: "variable_price" }));
  let created = 0;
  mock.method(RepairQuotation, "create", async (value: any) => { created++; return { ...value, _id: new Types.ObjectId() }; });
  mock.method(RepairQuotationItem, "insertMany", async () => []);
  const quote = (price: number, discountAmount = 0) => AssignmentService.createRepairQuotation({
    orderId: order._id.toString(), discountAmount,
    items: [{ title: "Công sửa chữa", itemType: "labor", quantity: 1, unitPrice: price }],
  }, provider.userId.toString());
  for (const price of [39999, 40000]) await assert.rejects(quote(price), /lớn hơn tiền cọc/);
  await assert.rejects(quote(50000, 10000), /lớn hơn tiền cọc/);
  assert.equal(created, 0);
  assert.equal((await quote(40001)).finalAmount, 40001);
  assert.equal(created, 1);
  mock.restoreAll();
}

async function run() {
  assert.equal(isQuotationRejectionReason("Lý do khác: Khách hàng không đồng ý báo giá"), false);
  for (const method of ["wallet", "payos"]) await testCancellation(method);
  await testCancellation("wallet", 20000);
  for (const invalid of ["unpaid", "completed", "ownership", "quotation", "in_progress"]) await testCancellation("wallet", 0, invalid);
  await testQuotationAmount();
  console.log("Đã kiểm tra hoàn đủ cọc, không cộng trùng, quyền hủy, điều kiện thanh toán và tổng báo giá lớn hơn cọc.");
}
run().catch((error) => { mock.restoreAll(); console.error(error); process.exitCode = 1; });
