import assert from "node:assert/strict";
import { mock } from "node:test";
import { ClientSession, Types } from "mongoose";
import { Order } from "../models/order.model";
import { RepairQuotation } from "../models/repairQuotation.model";
import { RewardAccount, RewardTransaction } from "../models/reward.model";
import { earnOrderRewards } from "../services/reward.service";
import * as config from "../services/systemConfig.service";
import { DEFAULT_REWARD_POLICY } from "../validations/reward.validator";

// Cô lập database; kiểm tra số điểm, điều kiện thanh toán và chống cộng trùng.
async function run() {
  let amountPerPoint = DEFAULT_REWARD_POLICY.amountPerPoint;
  mock.method(config, "getRewardPolicy", async () => ({ ...DEFAULT_REWARD_POLICY, amountPerPoint }));
  const session = {} as ClientSession;
  const order = new Order({
    customerId: new Types.ObjectId(), providerId: new Types.ObjectId(),
    currentQuotationId: new Types.ObjectId(), orderCode: "DON-TICH-DIEM",
    inspectionRequired: true, depositPaidAt: new Date(),
    status: "completed", paymentStatus: "paid", pricing: { totalPaidAmount: 15000 },
  });
  const quotation = new RepairQuotation({
    _id: order.currentQuotationId, orderId: order._id, customerId: order.customerId,
    providerId: order.providerId, status: "saved", finalAmount: 259000,
    directPaymentConfirmedAt: new Date(), directPaymentConfirmedAmount: 244000,
  });
  const transactions = new Map<string, any>();
  let balance = 0;
  let currentQuotation: typeof quotation | null = quotation;
  const query = <T>(value: T): any => ({ session: (valueSession: ClientSession) => {
    assert.equal(valueSession, session); return Promise.resolve(value);
  } });
  mock.method(RepairQuotation, "findOne", (filter: any) => {
    assert.equal(String(filter._id), String(order.currentQuotationId));
    assert.equal(String(filter.customerId), String(order.customerId));
    assert.equal(String(filter.providerId), String(order.providerId));
    assert.equal(filter.isDeleted, false);
    return query(currentQuotation);
  });
  mock.method(RewardTransaction, "exists", (filter: any) => query(transactions.get(filter._id) ?? null));
  mock.method(RewardAccount, "findOneAndUpdate", (filter: any, update: any, options: any) => {
    assert.equal(String(filter._id), String(order.customerId));
    assert.equal(options.session, session);
    assert.equal(options.runValidators, true);
    balance += update.$inc.balance;
    return Promise.resolve({ balance });
  });
  mock.method(RewardTransaction, "create", async (rows: any, options: any) => {
    assert.equal(options.session, session);
    transactions.set(rows[0]._id, rows[0]); return rows;
  });
  const earn = () => earnOrderRewards(order, session);
  try {
    order.status = "in_progress";
    await earn(); assert.equal(balance, 0);
    order.status = "completed";
    order.paymentStatus = "partially_paid";
    await earn(); assert.equal(balance, 0);
    order.paymentStatus = "paid";
    quotation.directPaymentConfirmedAt = null;
    await earn(); assert.equal(balance, 0);
    quotation.directPaymentConfirmedAt = new Date();
    currentQuotation = null;
    await earn(); assert.equal(balance, 0);
    currentQuotation = quotation;
    order.depositPaidAt = null;
    await earn(); assert.equal(balance, 0);
    order.depositPaidAt = new Date();
    quotation.finalAmount = 0;
    await earn(); assert.equal(balance, 0);
    quotation.finalAmount = 259000;
    await earn();
    assert.equal(balance, 25, "Tính theo tổng báo giá cuối cùng, không cộng thêm phí cọc.");
    assert.equal(transactions.get(`earn:${order._id}`).points, 25);
    await earn(); assert.equal(balance, 25, "Không cộng trùng khi thử lại.");
    order._id = new Types.ObjectId();
    order.inspectionRequired = false;
    order.pricing.totalPaidAmount = 105000;
    await earn(); assert.equal(balance, 35, "Đơn giá cố định vẫn tích điểm theo tiền thực trả.");
    amountPerPoint = 5000;
    await earn(); assert.equal(balance, 35, "Đổi cấu hình không tính lại điểm đã cộng.");
    order._id = new Types.ObjectId();
    await earn(); assert.equal(balance, 56, "Đơn tích điểm mới áp dụng mức chi tiêu admin đã cấu hình.");
    console.log("Đạt: tích điểm báo giá theo tổng cuối cùng, xác nhận thanh toán, làm tròn, chống trùng và đơn giá cố định.");
  } finally { mock.restoreAll(); }
}
run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
