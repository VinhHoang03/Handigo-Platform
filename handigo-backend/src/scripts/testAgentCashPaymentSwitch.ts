import assert from "node:assert/strict";
import Module from "node:module";
import { mock } from "node:test";
import mongoose, { Types } from "mongoose";
import { Order } from "../models/order.model";
import { Payment } from "../models/payment.model";
import { Wallet } from "../models/wallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import * as notifications from "../services/notification.service";
import * as vouchers from "../services/voucher.service";

// Kiểm tra service thật với database và PayOS cô lập, không thu tiền hoặc đọc bí mật.
async function run() {
  const gatewayPath = require.resolve("../configs/payos.config");
  const originalGateway = require.cache[gatewayPath];
  const gateway = new Module(gatewayPath);
  let gatewayCalls = 0;
  let gatewayFails = false;
  gateway.exports = { payos: { paymentRequests: { create: async (request: { returnUrl: string; cancelUrl: string }) => {
    const returned = new URL(request.returnUrl); const cancelled = new URL(request.cancelUrl);
    const returnedOrderId = returned.searchParams.get("orderId") ?? returned.pathname.split("/").pop();
    const cancelledOrderId = cancelled.searchParams.get("orderId") ?? cancelled.pathname.split("/").pop();
    assert.match(returnedOrderId ?? "", /^[a-f\d]{24}$/i);
    assert.equal(returnedOrderId, cancelledOrderId);
    assert.equal(returned.searchParams.get("payos"), "success");
    assert.equal(cancelled.searchParams.get("payos"), "cancel");
    gatewayCalls++;
    if (gatewayFails) throw new Error("Không tạo được QR");
    return { paymentLinkId: "lien-ket-moi", checkoutUrl: "https://pay.payos.vn/web/lien-ket-moi", qrCode: "QR" };
  } } }, payoutPayos: {} };
  require.cache[gatewayPath] = gateway;
  try {
    const payments = await import("../services/payment.service");
    const user = { id: new Types.ObjectId().toString(), role: "CUSTOMER" as const };
    const orderId = new Types.ObjectId().toString();
    const paymentId = new Types.ObjectId().toString();
    const amount = 150000;
    const order = { _id: orderId, customerId: user.id, orderCode: "ORD-TIEN-MAT", isDeleted: false,
      status: "accepted", paymentStatus: "unpaid", paymentMethod: "cash", orderType: "normal",
      inspectionRequired: false, pricing: { totalPaidAmount: amount }, save: async (_options?: unknown) => {} };
    const payment = { _id: paymentId, orderId, customerId: user.id, isDeleted: false,
      method: "cash", status: "pending", paymentType: "full", amount, metadata: { note: "Tiền mặt" },
      save: async () => {} };
    let balance = amount;
    let debitCalls = 0;
    let transactionFails = false;
    let balanceDrops = false;
    let paymentChanges = false;
    const session = { withTransaction: async (fn: () => Promise<unknown>) => {
      if (balanceDrops) balance = 0;
      if (paymentChanges) payment.status = "paid";
      const before = { order: { ...order }, payment: { ...payment }, balance };
      try { return await fn(); } catch (error) {
        Object.assign(order, before.order); Object.assign(payment, before.payment); balance = before.balance;
        throw error;
      }
    }, endSession: async () => {} };
    const query = <T>(value: T) => Object.assign(Promise.resolve(value), { session: async (actual: unknown) => {
      assert.equal(actual, session); return value;
    } });
    mock.method(mongoose, "startSession", async () => session as never);
    mock.method(Order, "findOne", (filter: { customerId: string }) => query(filter.customerId === user.id ? order : null));
    mock.method(Order, "findById", () => query(order));
    mock.method(Payment, "findOne", () => query(payment));
    mock.method(Wallet, "findOne", () => ({ select: async () => ({ balance }) }));
    mock.method(Wallet, "findOneAndUpdate", async (_filter: unknown, _update: unknown, options: { session: unknown }) => {
      assert.equal(options.session, session);
      if (balance < amount) return null;
      debitCalls++; balance -= amount; return { _id: "vi", balance };
    });
    mock.method(Payment, "findOneAndUpdate", async (filter: { method: string; status: string; _id: string },
      update: { $set: Record<string, unknown> }, options: { session: unknown; runValidators: boolean }) => {
      assert.equal(options.session, session); assert.equal(options.runValidators, true);
      assert.equal(filter._id, paymentId); assert.equal(filter.method, "cash"); assert.equal(filter.status, "pending");
      if (payment.method !== "cash" || payment.status !== "pending") return null;
      Object.assign(payment, update.$set); return payment;
    });
    mock.method(Payment, "create", async () => { throw new Error("Không được tạo giao dịch song song với tiền mặt"); });
    mock.method(WalletTransaction, "create", async (_rows: unknown, options: { session: unknown }) => {
      assert.equal(options.session, session);
      if (transactionFails) throw new Error("Lỗi ghi lịch sử ví");
      return [];
    });
    mock.method(notifications, "createNotificationRecord", async () => ({} as never));
    mock.method(vouchers, "markOrderVoucherAsUsed", async () => {});
    const reset = () => {
      order.status = "accepted"; order.paymentStatus = "unpaid"; order.paymentMethod = "cash";
      order.pricing.totalPaidAmount = amount; order.inspectionRequired = false;
      payment.method = "cash"; payment.status = "pending"; payment.amount = amount;
      balance = amount; debitCalls = 0; gatewayCalls = 0; gatewayFails = false;
      transactionFails = false; balanceDrops = false; paymentChanges = false;
    };
    const args = { orderId, method: "WALLET" as const };
    const expected = { amount, paymentType: "full" as const, previousPaymentId: paymentId, previousPaymentMethod: "cash" as const };
    const execute = () => payments.createAgentOrderPayment(user, args, expected);
    const preview = await payments.previewOrderPayment(user, orderId, "WALLET", true);
    assert.equal(preview.previousPaymentId, paymentId); assert.match(preview.note, /tiền mặt/);
    assert.equal(payment.method, "cash"); assert.equal(debitCalls, 0);
    await assert.rejects(() => payments.previewOrderPayment(user, orderId, "WALLET"));
    await assert.rejects(() => payments.createPayment(user, args));
    const walletResult = await execute();
    assert.equal(walletResult?.payment._id, paymentId); assert.equal(payment.method, "wallet");
    assert.equal(payment.status, "paid"); assert.equal(order.paymentStatus, "paid");
    assert.equal(order.paymentMethod, "wallet"); assert.equal(balance, 0); assert.equal(debitCalls, 1);
    await assert.rejects(execute); assert.equal(debitCalls, 1);
    reset();
    const payosResult = await payments.createAgentOrderPayment(user, { orderId, method: "PAYOS" }, expected);
    assert.equal(payosResult?.payment._id, paymentId); assert.equal(payment.method, "payos");
    assert.equal(payment.status, "pending"); assert.equal(order.paymentStatus, "unpaid");
    assert.equal(order.paymentMethod, "bank"); assert.equal(gatewayCalls, 1); assert.equal(debitCalls, 0);
    assert.match(payosResult!.checkoutUrl!, /lien-ket-moi/);
    await assert.rejects(execute);
    assert.equal(debitCalls, 0, "Form tiền mặt cũ không được dùng để hủy PayOS vừa tạo dù ID không đổi.");
    await assert.rejects(() => payments.createAgentOrderPayment(user, { orderId, method: "PAYOS" }, expected));
    assert.equal(gatewayCalls, 1);
    reset(); balance = amount - 1; await assert.rejects(execute, /Ví còn thiếu/);
    assert.equal(payment.method, "cash"); assert.equal(debitCalls, 0);
    reset(); balanceDrops = true; await assert.rejects(execute, /Số dư ví/);
    assert.equal(payment.method, "cash"); assert.equal(payment.status, "pending");
    reset(); transactionFails = true; await assert.rejects(execute, /Lỗi ghi lịch sử/);
    assert.equal(payment.method, "cash"); assert.equal(order.paymentMethod, "cash"); assert.equal(balance, amount);
    reset(); paymentChanges = true; await assert.rejects(execute); assert.equal(debitCalls, 0);
    for (const status of ["completed", "cancelled"]) {
      reset(); order.status = status; await assert.rejects(execute); assert.equal(debitCalls, 0);
    }
    reset(); order.status = "in_progress";
    await execute(); assert.equal(debitCalls, 1, "Đơn giá cố định đang thực hiện vẫn được thanh toán theo nghiệp vụ hiện có.");
    reset(); order.pricing.totalPaidAmount++; await assert.rejects(execute); assert.equal(debitCalls, 0);
    reset(); await assert.rejects(() => payments.createAgentOrderPayment({ ...user, id: new Types.ObjectId().toString() }, args, expected));
    assert.equal(debitCalls, 0);
    reset(); await assert.rejects(() => payments.createAgentOrderPayment(user, args, { ...expected, previousPaymentId: new Types.ObjectId().toString() }));
    assert.equal(debitCalls, 0);
    reset(); gatewayFails = true;
    await assert.rejects(() => payments.createAgentOrderPayment(user, { orderId, method: "PAYOS" }, expected), /liên kết thanh toán/);
    assert.equal(payment.status, "failed"); assert.equal(payment.method, "payos"); assert.equal(order.paymentStatus, "unpaid");
    console.log("Đạt: chuyển tiền mặt sang ví/PayOS, không trả trùng, transaction, ví thiếu, trạng thái đổi, quyền sở hữu và lỗi tạo QR.");
  } finally {
    mock.restoreAll();
    if (originalGateway) require.cache[gatewayPath] = originalGateway;
    else delete require.cache[gatewayPath];
  }
}
void run().catch((error: unknown) => { console.error("Kiểm thử chuyển tiền mặt thất bại.", error); process.exitCode = 1; });
