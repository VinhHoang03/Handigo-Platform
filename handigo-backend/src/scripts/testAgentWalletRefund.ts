import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { AppError } from "../utils/appError";

// Chạy nguyên hàm service với ví, giao dịch và cổng tiền cô lập; không đọc env hoặc kết nối database.
const source = readFileSync(resolve(__dirname, "../../src/services/orderCancellation.service.ts"), "utf8");
const ast = ts.createSourceFile("refund.ts", source, ts.ScriptTarget.Latest, true);
const names = ["hasPayosPayoutAttempt", "refundPayosPaymentToWallet", "requestPayosRefund", "refundWalletPayments"];
const declarations = ast.statements.filter((node) => ts.isVariableStatement(node)
  && node.declarationList.declarations.some((item) => names.includes(item.name.getText(ast))));
assert.equal(declarations.length, names.length);
const script = ts.transpileModule(declarations.map((node) => node.getText(ast)).join("\n")
  + "\nexports.run = requestPayosRefund; exports.duringCancellation = refundWalletPayments;", { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function fixture(balance: number | null = 50000) {
  const paymentId = "1".repeat(24);
  const order = { _id: "2".repeat(24), customerId: "3".repeat(24), orderCode: "ORD-HOAN-VI", status: "cancelled",
    cancellation: { cancelledByRole: "admin", refundPolicy: { policyVersion: "HANDIGO_REFUND_V1" } } };
  let state: any = { payment: { _id: paymentId, customerId: order.customerId, orderId: order._id,
    method: "payos", status: "paid", amount: 120000, metadata: { refund: { status: "failed" } } },
    refund: { paymentId, status: "failed", payoutId: null, channel: null, destination: null },
    wallet: balance === null ? null : { _id: "4".repeat(24), balance }, transactions: [], orderPaymentStatus: "paid" };
  let failLedger = false;
  let payoutReads = 0;
  let notifications = 0;
  let tail = Promise.resolve();
  const query = (value: unknown): any => ({ select: () => query(value), session: async () => value });
  const walletDocument = () => state.wallet ? { ...state.wallet, save: async function () { state.wallet.balance = this.balance; } } : null;
  const context: any = {
    exports: {}, AppError, Date,
    CUSTOMER_CANCELLATION_POLICY_VERSION: "CUSTOMER_CANCELLATION_V1",
    PAYOS_SOURCE_ACCOUNT_UNAVAILABLE_MESSAGE: "Chưa xác định được tài khoản nguồn để hoàn tiền PayOS",
    mongoose: { startSession: async () => ({
      withTransaction: async (callback: () => Promise<void>) => {
        const previous = tail; let unlock!: () => void;
        tail = new Promise<void>((done) => { unlock = done; });
        await previous;
        const snapshot = structuredClone(state);
        try { await callback(); } catch (error) { state = snapshot; throw error; } finally { unlock(); }
      }, endSession: async () => {},
    }) },
    WalletTransaction: {
      findOne: () => query(state.transactions[0] ?? null),
      create: async (rows: unknown[]) => {
        if (failLedger) throw new Error("Lỗi ghi lịch sử ví giả lập.");
        state.transactions.push(...structuredClone(rows));
      },
    },
    Payment: {
      find: () => query([structuredClone(state.payment)]),
      findById: () => query(structuredClone(state.payment)),
      updateOne: async (_filter: unknown, update: any) => { Object.assign(state.payment, update.$set); },
      findOneAndUpdate: async (_filter: unknown, update: any) => {
        if (state.payment.status !== "paid") return null;
        assert.ok(!state.payment.metadata.refund?.payoutId);
        Object.assign(state.payment, structuredClone(update.$set));
        return structuredClone(state.payment);
      },
    },
    Wallet: {
      findOne: () => query(walletDocument()),
      create: async (rows: any[]) => { state.wallet = { _id: "4".repeat(24), ...rows[0] }; return [walletDocument()]; },
    },
    Refund: { findOne: () => query(state.refund),
      updateOne: async (_filter: unknown, update: any) => { Object.assign(state.refund, update.$set); } },
    shouldRefundQrToWallet: () => true,
    isQuotationDepositPolicy: () => false,
    getPaymentRefundAmount: () => 120000,
    ensurePayosRefundRecord: async () => state.refund,
    claimRefund: async () => ["failed", "requested"].includes(state.refund.status)
      ? Object.assign(state.refund, { status: "requesting" }) : null,
    recordRefundFailure: async () => { state.refund.status = "failed"; },
    refreshCancelledOrderPaymentStatus: async () => { state.orderPaymentStatus = state.payment.status; },
    buildTransactionCode: () => "REFUND-KIEM-THU",
    createNotificationRecord: async () => { notifications++; },
    cancellationLogger: { error: () => {} },
    reconcilePayosRefund: async () => { payoutReads++; },
    payoutPayos: { payouts: { list: () => { throw new Error("Không gọi API tra lệnh chi mới."); },
      create: () => { throw new Error("Không tạo lệnh chi mới."); } } },
    payos: { paymentRequests: { get: () => { throw new Error("Không tra tài khoản nguồn để hoàn ví."); } } },
  };
  vm.runInNewContext(script, context);
  return { run: (amount = 120000) => context.exports.run(structuredClone(state.payment), order, "Không tìm thấy thợ.", amount),
    duringCancellation: () => context.exports.duringCancellation(order, "Khách hủy đơn.", {}),
    state: () => state, failLedger: (value: boolean) => { failLedger = value; },
    notifications: () => notifications, payoutReads: () => payoutReads };
}

async function run() {
  const full = fixture(); await full.run();
  assert.equal(full.state().wallet.balance, 170000);
  assert.equal(full.state().payment.status, "refunded");
  assert.equal(full.state().orderPaymentStatus, "refunded");
  assert.equal(full.state().refund.status, "succeeded");
  assert.equal(full.state().refund.destination, "handigo_wallet");
  assert.equal(full.state().transactions[0].relatedPaymentId, "1".repeat(24));
  await full.run();
  assert.equal(full.state().transactions.length, 1);
  assert.equal(full.state().wallet.balance, 170000);
  assert.equal(full.notifications(), 1);
  const missing = fixture(null); await missing.run(); assert.equal(missing.state().wallet.balance, 120000);
  const partial = fixture(); await partial.run(70000); assert.equal(partial.state().wallet.balance, 120000);
  const zero = fixture(); await zero.run(0); assert.equal(zero.state().transactions.length, 0);
  const rollback = fixture(); rollback.failLedger(true);
  await assert.rejects(rollback.run(), /Lỗi ghi lịch sử ví/);
  assert.equal(rollback.state().wallet.balance, 50000);
  assert.equal(rollback.state().payment.status, "paid");
  assert.equal(rollback.state().transactions.length, 0);
  assert.equal(rollback.state().refund.status, "failed");
  rollback.failLedger(false); await rollback.run(); assert.equal(rollback.state().wallet.balance, 170000);
  const race = fixture(); await Promise.all([race.run(), race.run()]);
  assert.equal(race.state().transactions.length, 1); assert.equal(race.state().wallet.balance, 170000);
  for (const patch of [{ channel: "payos_payout" }, { destination: "source_account" }]) {
    const uncertain = fixture(); Object.assign(uncertain.state().refund, patch);
    await assert.rejects(uncertain.run(), /cần đối soát/);
    assert.equal(uncertain.state().transactions.length, 0);
  }
  const legacy = fixture(); legacy.state().refund.payoutId = "payout-cu"; await legacy.run();
  assert.equal(legacy.payoutReads(), 1); assert.equal(legacy.state().transactions.length, 0);
  await legacy.duringCancellation();
  assert.equal(legacy.state().transactions.length, 0, "Nhánh hủy nhanh không bỏ qua lệnh chi PayOS cũ.");
  const metadata = fixture(); metadata.state().payment.metadata.refund.destination = "source_account";
  await assert.rejects(metadata.run(), /cần đối soát/); assert.equal(metadata.state().wallet.balance, 50000);
  console.log("Đạt hoàn PayOS về ví: đủ/một phần/0đ, tạo ví, chống lặp/đồng thời, rollback và chặn lệnh chi cũ chưa rõ kết quả; không gọi dịch vụ ngoài.");
}
void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
