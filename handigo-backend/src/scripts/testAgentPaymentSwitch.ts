import assert from "node:assert/strict";
import Module from "node:module";
import { mock } from "node:test";
import { Types } from "mongoose";
import { Order } from "../models/order.model";
import { Payment } from "../models/payment.model";
import { Wallet } from "../models/wallet.model";
import { AgentPaymentService } from "../services/agentPayment.service";
import { ActionPreconditionError } from "../utils/actionPreconditionError";

// Cô lập PayOS và database; không đọc cấu hình bí mật hoặc thực hiện thanh toán thật.
async function run() {
  const gatewayPath = require.resolve("../configs/payos.config");
  const originalGateway = require.cache[gatewayPath];
  const gateway = new Module(gatewayPath);
  const user = { id: new Types.ObjectId().toString(), role: "CUSTOMER" as const };
  const orderId = new Types.ObjectId().toString();
  const oldId = new Types.ObjectId().toString();
  const newId = new Types.ObjectId().toString();
  const amount = 150000;
  const order = { _id: orderId, customerId: user.id, orderCode: "ORD-DOI", status: "created",
    paymentStatus: "unpaid", orderType: "normal", inspectionRequired: false,
    pricing: { totalPaidAmount: amount }, depositAmount: amount };
  const oldPayment = { _id: oldId, orderId, customerId: user.id, status: "pending", method: "payos",
    paymentType: "full", amount, gatewayOrderCode: "12345", gatewayPaymentLinkId: "link-cu",
    gatewayResponse: { paymentLink: { checkoutUrl: "https://pay.payos.vn/web/link-cu" } } };
  let active: typeof oldPayment | null = oldPayment;
  let balance = amount;
  let link = { id: "link-cu", orderCode: 12345, amount, amountPaid: 0, status: "PENDING" };
  let cancelCalls = 0;
  let createCalls = 0;
  let reconciliations = 0;
  let cancelMode = "ok";
  let getFails = false;
  let updateWins = true;
  let onCancel: (() => void) | undefined;
  const requests = {
    get: async () => { if (getFails) throw new Error("Không kết nối được PayOS"); return { ...link }; },
    cancel: async (code: number) => {
      assert.equal(code, 12345); cancelCalls++;
      onCancel?.();
      if (cancelMode === "error") throw new Error("Hủy thất bại");
      if (cancelMode === "processing") { link.status = "PROCESSING"; return; }
      if (cancelMode === "paid") { link.status = "PAID"; link.amountPaid = amount; throw new Error("Vừa trả tiền"); }
      if (cancelMode === "partial") { link.status = "CANCELLED"; link.amountPaid = 10000; return; }
      link.status = "CANCELLED";
      if (cancelMode === "verify_error") getFails = true;
      if (cancelMode === "timeout") throw new Error("Mất kết nối sau khi hủy");
    },
  };
  gateway.exports = { payos: { paymentRequests: requests }, payoutPayos: {} };
  require.cache[gatewayPath] = gateway;
  try {
    const payments = await import("../services/payment.service");
    mock.method(Order, "findOne", async (filter: { customerId: string }) => filter.customerId === user.id ? order : null);
    mock.method(Order, "findById", async () => order);
    mock.method(Payment, "findOne", async (filter: { _id?: string; customerId?: string; method?: string | { $in: string[] }; status?: string | { $in: string[] } }) => {
      if (filter.customerId) assert.equal(filter.customerId, user.id);
      if (filter.method && !(typeof filter.method === "string" ? active?.method === filter.method : filter.method.$in.includes(active?.method ?? ""))) return null;
      if (typeof filter.status === "string" && active?.status !== filter.status) return null;
      if (filter.status && typeof filter.status !== "string" && !filter.status.$in.includes(active?.status ?? "")) return null;
      return filter._id ? active?._id === filter._id ? active : null : active;
    });
    mock.method(Wallet, "findOne", () => ({ select: async () => ({ balance }) }));
    mock.method(Payment, "updateOne", async (filter: { _id: string; status: string }, update: { $set: { status: string } }, options: { runValidators: boolean }) => {
      assert.equal(filter._id, oldId); assert.equal(filter.status, "pending");
      assert.equal(options.runValidators, true);
      if (!updateWins) return { modifiedCount: 0 };
      assert.equal(link.amountPaid, 0); assert(["CANCELLED", "EXPIRED", "FAILED"].includes(link.status));
      oldPayment.status = update.$set.status; active = null;
      return { modifiedCount: 1 };
    });
    mock.method(payments, "createPayment", async (_user: typeof user, input: { method: string; orderId: string }) => {
      assert.equal(active, null, "Phải xác minh và giải phóng giao dịch cũ trước khi tạo mới.");
      if (input.method === "WALLET" && balance < amount) throw new ActionPreconditionError("Số dư ví không đủ để thanh toán");
      assert.equal(input.orderId, orderId); createCalls++;
      active = { ...oldPayment, _id: newId, method: input.method === "WALLET" ? "wallet" : "cash",
        status: input.method === "WALLET" ? "paid" : "pending" };
      return { payment: active, amount, paymentType: active.paymentType } as never;
    });
    mock.method(payments, "reconcilePayosPaymentForOrder", async () => {
      reconciliations++; oldPayment.status = "paid"; active = oldPayment; return {} as never;
    });
    const reset = () => {
      active = oldPayment; oldPayment.status = "pending"; balance = amount;
      oldPayment.paymentType = "full"; order.inspectionRequired = false; order.status = "created";
      link = { id: "link-cu", orderCode: 12345, amount, amountPaid: 0, status: "PENDING" };
      cancelCalls = 0; createCalls = 0; reconciliations = 0; cancelMode = "ok"; getFails = false; updateWins = true;
      onCancel = undefined;
    };
    const args = { orderId, method: "WALLET" as const };
    const expected = { amount, paymentType: "full" as const, previousPaymentId: oldId, previousPaymentMethod: "payos" as const };
    const execute = () => payments.createAgentOrderPayment(user, args, expected);
    const noNewPayment = () => { assert.equal(createCalls, 0); assert.equal(oldPayment.status, "pending"); };

    const preview = await payments.previewOrderPayment(user, orderId, "WALLET", true);
    assert.equal(preview.previousPaymentId, oldId);
    assert.match(preview.note, /hủy liên kết PayOS/);
    assert.equal(cancelCalls, 0, "Xem trước chưa hủy liên kết.");
    await assert.rejects(() => payments.previewOrderPayment(user, orderId, "WALLET"), /Đang có giao dịch PayOS/);
    await execute();
    assert.equal(cancelCalls, 1); assert.equal(createCalls, 1); assert.equal(oldPayment.status, "failed");
    await assert.rejects(execute); assert.equal(createCalls, 1, "Gửi lặp không tạo giao dịch thứ hai.");
    reset(); await payments.createAgentOrderPayment(user, { orderId, method: "CASH" }, expected);
    assert.equal(active?.method, "cash"); assert.equal(active?.status, "pending");

    reset(); balance = amount - 1;
    await assert.rejects(execute, /Ví còn thiếu/); assert.equal(cancelCalls, 0); noNewPayment();
    reset(); order.inspectionRequired = true;
    await assert.rejects(() => payments.createAgentOrderPayment(user, { orderId, method: "CASH" }, expected), /khảo sát/);
    assert.equal(cancelCalls, 0); noNewPayment();
    reset(); await assert.rejects(() => payments.createAgentOrderPayment({ ...user, id: new Types.ObjectId().toString() }, args, expected), /Không tìm thấy/);
    assert.equal(cancelCalls, 0); noNewPayment();
    reset(); await assert.rejects(() => payments.createAgentOrderPayment(user, args, { ...expected, previousPaymentId: newId }));
    assert.equal(cancelCalls, 0); noNewPayment();
    reset(); await assert.rejects(() => payments.createAgentOrderPayment(user, args, { ...expected, amount: amount + 1 }));
    assert.equal(cancelCalls, 0); noNewPayment();
    for (const state of ["PROCESSING", "PENDING", "CANCELLED"]) {
      reset(); link.status = state; link.amountPaid = state === "PROCESSING" ? 0 : 10000;
      await assert.rejects(execute, /đã nhận tiền|đang xử lý/); assert.equal(cancelCalls, 0); noNewPayment();
    }
    reset(); cancelMode = "error";
    await assert.rejects(execute, /Chưa xác minh/); noNewPayment();
    reset(); cancelMode = "partial";
    await assert.rejects(execute, /Chưa xác minh/); noNewPayment();
    reset(); cancelMode = "processing";
    await assert.rejects(execute, /Chưa xác minh/); noNewPayment();
    reset(); getFails = true;
    await assert.rejects(execute, /Không thể kiểm tra PayOS/); assert.equal(cancelCalls, 0); noNewPayment();
    reset(); cancelMode = "verify_error";
    await assert.rejects(execute, /Không thể kiểm tra PayOS/); noNewPayment();
    reset(); link.id = "link-khac";
    await assert.rejects(execute, /không khớp/); assert.equal(cancelCalls, 0); noNewPayment();
    reset(); updateWins = false;
    await assert.rejects(execute); noNewPayment();
    reset(); const aborted = new AbortController(); aborted.abort();
    await assert.rejects(() => payments.createAgentOrderPayment(user, args, expected, aborted.signal));
    assert.equal(cancelCalls, 0); noNewPayment();
    reset(); const timedOut = new AbortController(); onCancel = () => timedOut.abort();
    await assert.rejects(() => payments.createAgentOrderPayment(user, args, expected, timedOut.signal));
    assert.equal(cancelCalls, 1); noNewPayment();
    reset(); cancelMode = "timeout";
    await execute(); assert.equal(createCalls, 1, "Chỉ tiếp tục khi lần kiểm tra sau xác nhận đã hủy.");
    reset(); link.status = "PAID"; link.amountPaid = amount;
    await execute(); assert.equal(createCalls, 0); assert.equal(cancelCalls, 0); assert.equal(reconciliations, 1);
    reset(); cancelMode = "paid";
    await execute(); assert.equal(createCalls, 0); assert.equal(reconciliations, 1);

    // Cùng endpoint web: không cần khách tự hủy QR trước khi chọn ví/tiền mặt.
    reset();
    const webWallet = await payments.createOrderPayment(user, { orderId, method: "WALLET", expectedAmount: amount });
    assert.equal(webWallet.payment.method, "wallet"); assert.equal(cancelCalls, 1); assert.equal(createCalls, 1);
    reset();
    const webCash = await payments.createOrderPayment(user, { orderId, method: "CASH", expectedAmount: amount });
    assert.equal(webCash.payment.method, "cash"); assert.equal(webCash.payment.status, "pending"); assert.equal(cancelCalls, 1);
    reset(); balance = 0;
    await assert.rejects(payments.createOrderPayment(user, { orderId, method: "WALLET" }), /Ví còn thiếu/);
    assert.equal(cancelCalls, 0); noNewPayment();
    reset(); cancelMode = "error";
    await assert.rejects(payments.createOrderPayment(user, { orderId, method: "CASH" }), /Chưa xác minh/); noNewPayment();
    reset(); cancelMode = "paid";
    const received = await payments.createOrderPayment(user, { orderId, method: "WALLET", expectedAmount: amount });
    assert.equal(received.payment.method, "payos"); assert.equal(received.payment.status, "paid"); assert.equal(createCalls, 0);
    reset(); oldPayment.status = "paid";
    assert.equal((await payments.createOrderPayment(user, { orderId, method: "WALLET" })).payment._id, oldId);
    assert.equal(createCalls, 0); assert.equal(cancelCalls, 0);
    reset();
    await assert.rejects(payments.createOrderPayment(user, { orderId, method: "WALLET", expectedAmount: amount - 1 }), /Thông tin hoặc chi phí đã thay đổi/);
    assert.equal(cancelCalls, 0); noNewPayment();
    reset(); order.inspectionRequired = true;
    await assert.rejects(payments.createOrderPayment(user, { orderId, method: "CASH" }), /khảo sát/);
    assert.equal(cancelCalls, 0); noNewPayment();
    reset();
    await assert.rejects(payments.createOrderPayment({ ...user, id: new Types.ObjectId().toString() }, { orderId, method: "WALLET" }), /không có quyền/);
    assert.equal(cancelCalls, 0); noNewPayment();

    // Tích hợp service trợ lý: form cũ không được áp dụng cho giao dịch mới và lỗi hủy có thể kiểm tra lại.
    reset();
    mock.method(Order, "findOne", () => ({ exec: async () => order }));
    mock.method(Payment, "find", () => ({ sort: () => ({ exec: async () => active ? [active] : [oldPayment] }) }));
    mock.method(payments, "previewOrderPayment", async () => ({ ...preview }));
    const result = await AgentPaymentService.pay(user, args, preview);
    assert.equal(result.status, "paid"); assert.equal(result.checkoutUrl, undefined); assert.equal(result.paymentId, newId);
    reset(); cancelMode = "error";
    const blocked = await AgentPaymentService.pay(user, args, preview);
    assert.equal(blocked.status, "blocked"); assert.match(blocked.message, /Chưa xác minh/); noNewPayment();
    reset(); onCancel = () => { balance = 0; };
    const depleted = await AgentPaymentService.pay(user, args, preview);
    assert.equal(depleted.status, "blocked"); assert.match(depleted.message, /Liên kết PayOS cũ đã hủy/);
    assert.equal(createCalls, 0); assert.equal(oldPayment.status, "failed");
    reset(); const stale = await AgentPaymentService.pay(user, args, { ...preview, previousPaymentId: newId });
    assert.equal(stale.status, "blocked"); assert.equal(cancelCalls, 0); noNewPayment();
    console.log("Đã kiểm tra đổi PayOS sang ví/tiền mặt, quyền sở hữu, số dư, xác nhận cũ, thao tác lặp, nhận tiền đồng thời và lỗi hủy.");
  } finally {
    mock.restoreAll();
    if (originalGateway) require.cache[gatewayPath] = originalGateway;
    else delete require.cache[gatewayPath];
  }
}

void run().catch((error: unknown) => { console.error("Kiểm thử đổi phương thức thanh toán thất bại.", error); process.exitCode = 1; });
