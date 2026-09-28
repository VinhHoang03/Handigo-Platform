import assert from "node:assert/strict";
import { mock } from "node:test";
import { randomUUID } from "node:crypto";
import mongoose, { ClientSession, Types } from "mongoose";
import { calculateRewardPoints } from "../configs/rewards";
import { RewardAccount, RewardTransaction } from "../models/reward.model";
import { Promotion } from "../models/promotion.model";
import { Order, IOrder } from "../models/order.model";
import { earnOrderRewards, redeemReward } from "../services/reward.service";
import { resolveVoucherForAmount, reservePersonalVoucher } from "../services/voucher.service";
import { redeemRewardSchema } from "../validations/reward.validator";

/** Kiểm tra service với model giả lập; không đọc cấu hình, không kết nối database. */
async function main() {
  assert.equal(calculateRewardPoints(199_999), 19);
  assert.equal(calculateRewardPoints(9_999), 0);
  assert.equal(calculateRewardPoints(-10_000), 0);
  assert.equal(calculateRewardPoints(Number.NaN), 0);
  assert.equal(redeemRewardSchema.safeParse({ offerId: "SAVE10", requestId: randomUUID(), points: 1 }).success, false);
  assert.equal(redeemRewardSchema.safeParse({ offerId: "SAVE10", requestId: "invalid" }).success, false);

  const userId = new Types.ObjectId();
  const orderId = new Types.ObjectId();
  const session = {} as ClientSession;
  const order = { _id: orderId, customerId: userId, orderCode: "HD-TEST", status: "completed", paymentStatus: "paid", inspectionRequired: false, pricing: { totalPaidAmount: 199_999 } } as IOrder;
  let credited = false;
  const exists = mock.method(RewardTransaction, "exists", () => ({ session: async () => credited }));
  const credit = mock.method(RewardAccount, "findOneAndUpdate", async (filter: any, update: any, options: any) => {
    assert.equal(filter._id.toString(), userId.toString());
    assert.equal(update.$inc.balance, 19);
    assert.equal(options.session, session);
    return { balance: 19 };
  });
  const ledger = mock.method(RewardTransaction, "create", async (rows: any[], options: any) => {
    assert.equal(rows[0]._id, `earn:${orderId}`);
    assert.equal(options.session, session);
    credited = true;
    return rows;
  });
  await earnOrderRewards({ ...order, status: "cancelled" } as IOrder, session);
  await earnOrderRewards({ ...order, paymentStatus: "unpaid" } as IOrder, session);
  await earnOrderRewards({ ...order, inspectionRequired: true } as IOrder, session);
  assert.equal(credit.mock.callCount(), 0);
  await earnOrderRewards(order, session);
  await earnOrderRewards(order, session);
  assert.equal(credit.mock.callCount(), 1);
  assert.equal(ledger.mock.callCount(), 1);
  exists.mock.restore(); credit.mock.restore(); ledger.mock.restore();

  const voucherId = new Types.ObjectId();
  const voucher = {
    _id: voucherId, ownerId: userId, reservedOrderId: null as Types.ObjectId | null,
    isDeleted: false, isActive: true, status: "ACTIVE", usedCount: 0, usageLimit: 1,
    startAt: new Date(Date.now() - 1000), endAt: new Date(Date.now() + 86400000),
    discountType: "AMOUNT", discountValue: 10000, minOrderAmount: 100000,
    save: async (options: any) => { assert.equal(options.session, session); },
  };
  const findCode = mock.method(Promotion, "findOne", () => ({ then: (resolve: (value: unknown) => void) => resolve(voucher) }));
  await assert.rejects(resolveVoucherForAmount("CODE", 200000, undefined, new Types.ObjectId().toString()), /không thuộc/);
  await assert.rejects(resolveVoucherForAmount("CODE", 99999, undefined, userId.toString()), /tối thiểu/);
  const valid = await resolveVoucherForAmount("CODE", 200000, undefined, userId.toString());
  assert.equal(valid.discountAmount, 10000);
  findCode.mock.restore();
  const findVoucher = mock.method(Promotion, "findById", () => ({ session: async () => voucher }));
  const findOrder = mock.method(Order, "findOne", () => ({ session: async () => ({ _id: orderId }) }));
  await assert.rejects(reservePersonalVoucher(voucherId, new Types.ObjectId().toString(), orderId, false, session), /không thuộc/);
  await assert.rejects(reservePersonalVoucher(voucherId, userId.toString(), orderId, true, session), /giá cố định/);
  await reservePersonalVoucher(voucherId, userId.toString(), orderId, false, session);
  assert.equal(voucher.reservedOrderId?.toString(), orderId.toString());
  await assert.rejects(reservePersonalVoucher(voucherId, userId.toString(), new Types.ObjectId(), false, session), /đơn khác/);
  voucher.usedCount = 1;
  await assert.rejects(reservePersonalVoucher(voucherId, userId.toString(), orderId, false, session), /đã dùng/);
  findVoucher.mock.restore(); findOrder.mock.restore();

  let balance = 150;
  let stored: any = null;
  let failCreation = false;
  mock.method(mongoose.connection, "transaction", async (run: (value: ClientSession) => Promise<unknown>) => {
    const before = balance;
    try { return await run(session); } catch (error) { balance = before; throw error; }
  });
  mock.method(RewardTransaction, "findById", () => ({ session: async () => stored }));
  const debit = mock.method(RewardAccount, "findOneAndUpdate", async (filter: any, update: any, options: any) => {
    assert.equal(filter._id, userId.toString());
    assert.equal(filter.balance.$gte, 100);
    assert.equal(options.session, session);
    if (balance < filter.balance.$gte) return null;
    balance += update.$inc.balance;
    return { balance };
  });
  mock.method(Promotion, "create", async (rows: any[], options: any) => {
    assert.equal(options.session, session);
    assert.equal(rows[0].ownerId, userId.toString());
    assert.equal(rows[0].usageLimit, 1);
    if (failCreation) throw new Error("Lỗi lưu mã giả lập");
    return [{ ...rows[0], _id: voucherId }];
  });
  mock.method(RewardTransaction, "create", async (rows: any[]) => { stored = rows[0]; return rows; });
  mock.method(Promotion, "findById", () => ({ session: async () => voucher }));
  const requestId = randomUUID();
  failCreation = true;
  await assert.rejects(redeemReward(userId.toString(), "SAVE10", requestId), /giả lập/);
  assert.equal(balance, 150);
  failCreation = false;
  await redeemReward(userId.toString(), "SAVE10", requestId);
  assert.equal(balance, 50);
  const calls = debit.mock.callCount();
  await redeemReward(userId.toString(), "SAVE10", requestId);
  assert.equal(debit.mock.callCount(), calls);
  await assert.rejects(redeemReward(userId.toString(), "SAVE25", requestId), /ưu đãi khác/);
  stored = null;
  await assert.rejects(redeemReward(userId.toString(), "SAVE10", randomUUID()), /chưa đủ điểm/);
  assert.equal(balance, 50);
  await assert.rejects(redeemReward(userId.toString(), "UNKNOWN", randomUUID()), /không tồn tại/);
  mock.restoreAll();
  console.log("Đã đạt kiểm tra điểm, điều kiện đơn, quyền sở hữu, giữ mã, đổi điểm và chống gửi lặp (model giả lập).");
}

main().catch((error) => { mock.restoreAll(); console.error(error); process.exitCode = 1; });
