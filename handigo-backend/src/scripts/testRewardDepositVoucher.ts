import assert from "node:assert/strict";
import { mock } from "node:test";
import mongoose, { Types } from "mongoose";
import { Order } from "../models/order.model";
import { Payment } from "../models/payment.model";
import { Promotion } from "../models/promotion.model";
import { Wallet } from "../models/wallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { RewardAccount, RewardTransaction } from "../models/reward.model";
import { REWARD_POLICY } from "../configs/rewards";

// Cô lập dịch vụ ngoài; không đọc bí mật, kết nối database hoặc gọi PayOS.
const stubModule = (path: string, exports: object) => {
  require.cache[require.resolve(path)] = { exports } as NodeModule;
};
let dispatches = 0;
stubModule("../configs/payos.config", { payos: {}, payoutPayos: {} });
stubModule("../services/systemConfig.service", { getRewardOffers: async () => REWARD_POLICY.offers.map((offer) => ({ ...offer, isActive: true })) });
stubModule("../services/notification.service", { createNotificationRecord: async () => ({}) });
stubModule("../services/dispatch.service", { DispatchService: { dispatchReadyOrder: async () => { dispatches++; } } });
const { createPayment } = require("../services/payment.service") as typeof import("../services/payment.service");
const { resolveVoucherForAmount, reservePersonalVoucher, getAvailableVouchers } = require("../services/voucher.service") as typeof import("../services/voucher.service");
const { redeemReward } = require("../services/reward.service") as typeof import("../services/reward.service");

async function run() {
  const user = { id: new Types.ObjectId().toString(), role: "CUSTOMER" as const };
  const order = new Order({ customerId: user.id, serviceId: new Types.ObjectId(), addressId: new Types.ObjectId(),
    orderCode: "DON-MIEN-COC", status: "created", orderType: "normal", paymentMethod: "bank",
    paymentStatus: "unpaid", inspectionRequired: true, depositAmount: 20000,
    pricing: { baseAmount: 20000, bookingAmount: 20000, totalPaidAmount: 0, voucherDiscountAmount: 20000,
      platformCommissionRate: 0, platformCommissionAmount: 0, providerEarningAmount: 0 } });
  const voucher = new Promotion({ ownerId: user.id, code: "MIENCOC", name: "Miễn phí cọc",
    applicableOrderType: "variable_price", discountType: "PERCENT", discountValue: 50,
    usageLimit: 1, startAt: new Date(Date.now() - 1000), endAt: new Date(Date.now() + 100000) });
  const session = { withTransaction: async (fn: () => Promise<unknown>) => fn(), endSession: async () => {} };
  const query = <T>(value: T): any => Object.assign(Promise.resolve(value), { session: () => query(value), select: () => query(value) });
  let payment: InstanceType<typeof Payment> | null = null;
  let balance = 800;
  const redeemed = new Map<string, any>();
  const promotions = new Map<string, InstanceType<typeof Promotion>>();
  mock.method(mongoose.connection, "transaction", async (fn: any) => fn(session));
  mock.method(RewardAccount, "findOneAndUpdate", (filter: any, update: any) => {
    if (balance < filter.balance.$gte) return query(null);
    balance += update.$inc.balance;
    return query({ balance });
  });
  mock.method(RewardTransaction, "findById", (key: string) => query(redeemed.get(key)));
  mock.method(RewardTransaction, "create", async (rows: any) => { redeemed.set(rows[0]._id, rows[0]); return rows; });
  mock.method(Promotion, "create", async (rows: any) => {
    const created = new Promotion(rows[0]); promotions.set(created.id, created); return [created] as never;
  });
  mock.method(mongoose, "startSession", async () => session as never);
  mock.method(Promotion, "findOne", () => query(voucher));
  mock.method(Promotion, "findById", (id: any) => query(promotions.get(String(id)) ?? voucher));
  mock.method(Promotion, "find", () => ({ sort: async () => [voucher] }));
  mock.method(Order, "find", () => ({ select: () => ({ lean: async () => [] }) }));
  mock.method(Promotion, "exists", () => query(voucher.applicableOrderType === "variable_price" && voucher.discountValue === 100));
  mock.method(Promotion.prototype, "save", async function (this: InstanceType<typeof Promotion>) { return this; });
  mock.method(Promotion, "updateOne", async () => { voucher.usedCount++; return {} as never; });
  mock.method(Order, "findById", () => query(order));
  mock.method(Order, "findOneAndUpdate", () => query(order));
  mock.method(Order.prototype, "save", async function (this: InstanceType<typeof Order>) { return this; });
  mock.method(Payment, "findOne", () => query(payment));
  mock.method(Payment, "create", async (rows: any) => { payment = new Payment(rows[0]); return [payment] as never; });
  mock.method(Wallet, "findOneAndUpdate", async () => { throw new Error("Không được trừ ví khi miễn cọc."); });
  mock.method(WalletTransaction, "create", async () => { throw new Error("Không được tạo giao dịch ví 0 đồng."); });
  try {
    const halfReward = await redeemReward(user.id, "DEPOSIT50", "doi-50");
    assert.equal(balance, 500);
    assert.equal(halfReward!.discountValue, 50);
    assert.equal(halfReward!.applicableOrderType, "variable_price");
    const fullReward = await redeemReward(user.id, "DEPOSIT100", "doi-100");
    assert.equal(balance, 0);
    assert.equal(fullReward!.maxDiscountAmount, 30000);
    assert.equal(fullReward!.discountType, "PERCENT");
    assert.equal((await redeemReward(user.id, "DEPOSIT100", "doi-100"))!.id, fullReward!.id);
    assert.equal(balance, 0, "Thử lại yêu cầu không bị trừ điểm lần nữa.");
    await assert.rejects(() => redeemReward(user.id, "DEPOSIT50", "doi-khong-du"), /chưa đủ điểm/);
    const half = await resolveVoucherForAmount(voucher.code!, 40000, undefined, user.id, true);
    assert.equal(half.discountAmount, 20000);
    assert.equal((await getAvailableVouchers(user, {}, { amountBeforeVoucher: 40000, inspectionRequired: true }))[0].discountAmount, 20000);
    assert.equal((await getAvailableVouchers(user, {}, { amountBeforeVoucher: 40000, inspectionRequired: false })).length, 0);
    voucher.applicableOrderType = null;
    await assert.rejects(() => resolveVoucherForAmount(voucher.code!, 40000, undefined, user.id, true), /chỉ áp dụng cho đơn giá cố định/);
    voucher.applicableOrderType = "variable_price";
    await assert.rejects(() => resolveVoucherForAmount(voucher.code!, 40000, undefined, user.id, false), /chỉ áp dụng cho đơn báo giá/);
    await assert.rejects(() => resolveVoucherForAmount(voucher.code!, 40000, undefined, new Types.ObjectId().toString(), true), /không thuộc tài khoản/);
    await assert.rejects(() => reservePersonalVoucher(voucher._id as Types.ObjectId, user.id, order._id as Types.ObjectId, false, session as never), /chỉ áp dụng cho đơn báo giá/);
    voucher.discountValue = 100;
    voucher.maxDiscountAmount = fullReward!.maxDiscountAmount;
    assert.equal((await resolveVoucherForAmount(voucher.code!, 40000, undefined, user.id, true)).discountAmount, 30000);
    assert.equal((await resolveVoucherForAmount(voucher.code!, 30000, undefined, user.id, true)).discountAmount, 30000);
    assert.equal((await resolveVoucherForAmount(voucher.code!, 20000, undefined, user.id, true)).discountAmount, 20000);
    assert.equal((await getAvailableVouchers(user, {}, { amountBeforeVoucher: 40000, inspectionRequired: true }))[0].finalAmount, 10000);
    await reservePersonalVoucher(voucher._id as Types.ObjectId, user.id, order._id as Types.ObjectId, true, session as never);
    order.voucherSnapshot = (await resolveVoucherForAmount(voucher.code!, 20000, undefined, user.id, true)).snapshot;
    const result = await createPayment(user, { orderId: order.id, method: "PAYOS", paymentType: "INSPECTION_DEPOSIT" });
    assert.equal(result.payment.amount, 0);
    assert.equal(result.payment.status, "paid");
    assert.equal(order.paymentStatus, "partially_paid");
    assert.ok(order.depositPaidAt);
    assert.equal(order.readyForMatching, true);
    assert.equal(voucher.usedCount, 1);
    await Promise.resolve();
    assert.equal(dispatches, 1);
    await assert.rejects(() => createPayment(user, { orderId: order.id, method: "PAYOS" }), /đã có giao dịch/);
    payment = null;
    voucher.applicableOrderType = "fixed_price";
    await assert.rejects(() => createPayment(user, { orderId: order.id, method: "PAYOS" }), /không hợp lệ/);
    console.log("Đã kiểm tra giảm cọc 50%/100%, loại đơn, quyền sở hữu, miễn cọc, tìm thợ và chặn thanh toán trùng.");
  } finally { mock.restoreAll(); }
}
run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
