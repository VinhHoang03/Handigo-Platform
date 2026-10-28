import assert from "node:assert/strict";
import Module from "node:module";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import { Types } from "mongoose";
import { Order } from "../models/order.model";
import { Payment } from "../models/payment.model";
import { AgentPaymentService } from "../services/agentPayment.service";
import { AgentService, sessionView } from "../ai/agent/agent.service";
import { AgentLoop } from "../ai/agent/agent-loop.service";
import { newSession } from "../ai/agent/agent-state";
import { ToolRegistry } from "../ai/tools/tool-registry";
import { cancelPaymentTool, getPaymentStatusTool } from "../ai/tools/implementations/payment.tools";
import { parseBookingHistoryRequest } from "../ai/agent/booking-history";

// Cô lập database, model và PayOS; không đọc bí mật hoặc hủy giao dịch thật.
async function run() {
  const gatewayPath = require.resolve("../configs/payos.config");
  const originalGateway = require.cache[gatewayPath];
  const gateway = new Module(gatewayPath);
  const user = { id: new Types.ObjectId().toString(), role: "CUSTOMER" as const };
  const orderId = new Types.ObjectId().toString(), paymentId = new Types.ObjectId().toString();
  const replacementId = new Types.ObjectId().toString();
  const order = new Order({ _id: orderId, customerId: user.id, orderCode: "HD-HUY-QR", status: "created",
    orderType: "normal", paymentStatus: "unpaid", paymentMethod: "bank", paymentDueAt: new Date(Date.now() + 900000) });
  const payment = new Payment({ _id: paymentId, customerId: user.id, orderId, method: "payos", paymentType: "full",
    amount: 150000, status: "pending", gatewayOrderCode: "12345", gatewayPaymentLinkId: "qr-kiem-thu" });
  let rows = [payment];
  let link = { id: "qr-kiem-thu", orderCode: 12345, amount: 150000, amountPaid: 0, status: "PENDING" };
  let cancelCalls = 0, modelCalls = 0;
  let mode = "ok", crashAfterWrite = false;
  const query = <T>(value: T) => Object.assign(Promise.resolve(value), { exec: async () => value });
  gateway.exports = { payos: { paymentRequests: {
    get: async () => { if (mode === "lookup_error") throw Error("Lỗi tra PayOS giả lập"); return { ...link }; },
    cancel: async () => {
      cancelCalls++;
      if (mode === "cancel_error") throw Error("Lỗi hủy giả lập");
      if (mode === "paid_during_cancel") { link.status = "PAID"; link.amountPaid = payment.amount; return; }
      link.status = "CANCELLED";
      if (mode === "partial") link.amountPaid = 1000;
      if (mode === "lost_response") throw Error("Mất phản hồi sau hủy");
    },
  } }, payoutPayos: {} };
  require.cache[gatewayPath] = gateway;
  try {
    const payments = await import("../services/payment.service");
    mock.method(Order, "findOne", (filter: { customerId: string }) => query(filter.customerId === user.id ? order : null));
    mock.method(Order, "updateOne", async () => { throw Error("Hủy QR không được sửa đơn"); });
    mock.method(Payment, "findOne", (filter: Record<string, unknown>) => query(rows.find((item) => Object.entries(filter)
      .every(([key, value]) => key === "isDeleted" ? !item.isDeleted
        : String(item.get(key)) === String(value))) ?? null));
    mock.method(Payment, "find", () => ({ sort: () => query(rows) }));
    mock.method(Payment, "updateOne", async (filter: { _id: string; status: string }, update: { $set: Record<string, unknown> }, options: { runValidators: boolean }) => {
      assert.equal(String(filter._id), paymentId);
      assert.equal(filter.status, "pending");
      assert(options.runValidators);
      if (payment.status !== "pending") return { modifiedCount: 0 };
      for (const [key, value] of Object.entries(update.$set)) payment.set(key, value);
      if (crashAfterWrite) throw Error("Mất kết nối sau khi ghi kết quả hủy");
      return { modifiedCount: 1 };
    });
    mock.method(payments, "createPayment", async () => { throw Error("Hủy QR không được tạo thanh toán mới"); });
    mock.method(payments, "reconcilePayosPaymentForOrder", async () => {
      if (link.status === "PAID") { payment.status = "paid"; order.paymentStatus = "paid"; }
      else if (["CANCELLED", "EXPIRED", "FAILED"].includes(link.status) && link.amountPaid === 0) {
        payment.status = "failed"; payment.gatewayResponse = { reconciliation: { ...link } };
      }
      return {} as never;
    });
    const reset = () => {
      payment.status = "pending"; payment.paymentType = "full"; payment.metadata = null;
      payment.gatewayResponse = { paymentLink: { checkoutUrl: "https://pay.payos.vn/web/qr-kiem-thu" } };
      order.status = "created"; order.paymentStatus = "unpaid"; order.inspectionRequired = false;
      rows = [payment]; cancelCalls = 0; mode = "ok"; crashAfterWrite = false;
      link = { id: "qr-kiem-thu", orderCode: 12345, amount: 150000, amountPaid: 0, status: "PENDING" };
    };
    const expected = { paymentId, amount: payment.amount, paymentType: "full" as const };
    const actionId = randomUUID();
    const execute = () => payments.cancelAgentPendingPayment(user, orderId, expected, actionId);
    reset();
    const initialOrder = JSON.stringify(order.toObject());
    const preview = await payments.previewAgentPaymentCancellation(user, orderId, paymentId);
    assert.equal(preview.paymentId, paymentId); assert.equal(cancelCalls, 0);
    await execute();
    assert.equal(payment.status, "failed"); assert.equal(payment.metadata?.customerCancelledQr, true);
    assert.equal(JSON.stringify(order.toObject()), initialOrder, "Giữ nguyên đơn, phương thức và thời hạn thanh toán.");
    await execute(); assert.equal(cancelCalls, 1, "Gửi lặp cùng hành động không hủy lần hai.");
    const cancelled = await AgentPaymentService.status(user, orderId, false);
    assert.match(cancelled.message, /Đã hủy giao dịch QR/); assert.equal(cancelled.checkoutUrl, undefined);
    assert(await AgentPaymentService.cancellationConfirmed(user, cancelled, paymentId));
    reset(); payment.paymentType = "inspection_deposit";
    await payments.cancelAgentPendingPayment(user, orderId, { ...expected, paymentType: "inspection_deposit" }, randomUUID());
    assert.equal(order.paymentStatus, "unpaid"); assert.equal(payment.status, "failed");
    reset();
    await assert.rejects(() => payments.previewAgentPaymentCancellation({ ...user, id: new Types.ObjectId().toString() }, orderId), /Không tìm thấy/);
    await assert.rejects(() => payments.cancelAgentPendingPayment({ ...user, role: "PROVIDER" }, orderId, expected, actionId), /chỉ dành cho khách hàng/);
    await assert.rejects(() => payments.cancelAgentPendingPayment(user, orderId, { ...expected, paymentId: replacementId }, actionId));
    await assert.rejects(() => payments.cancelAgentPendingPayment(user, orderId, { ...expected, amount: 1 }, actionId));
    assert.equal(cancelCalls, 0);
    reset(); order.status = "completed"; await assert.rejects(execute); assert.equal(cancelCalls, 0);
    reset(); order.status = "in_progress";
    await payments.previewAgentPaymentCancellation(user, orderId);
    await execute(); assert.equal(payment.status, "failed"); assert.equal(order.status, "in_progress");
    reset(); order.status = "in_progress"; order.inspectionRequired = true;
    await assert.rejects(() => payments.previewAgentPaymentCancellation(user, orderId), /trạng thái/);
    await assert.rejects(execute); assert.equal(cancelCalls, 0);
    reset(); order.status = "cancelled"; await assert.rejects(execute); assert.equal(cancelCalls, 0);
    reset(); order.status = "in_progress"; order.orderType = "scheduled"; rows = [];
    assert.equal((await AgentPaymentService.status(user, orderId, false)).status, "unpaid", "Đơn giá cố định đang làm không bị trả về bước chờ thợ nhận lịch.");
    order.inspectionRequired = true;
    assert.equal((await AgentPaymentService.status(user, orderId, false)).status, "blocked");
    order.orderType = "normal";
    reset(); payment.status = "paid"; order.paymentStatus = "paid";
    await assert.rejects(() => payments.previewAgentPaymentCancellation(user, orderId), /đã ghi nhận thanh toán/);
    await execute(); assert.equal(cancelCalls, 0);
    for (const scenario of ["cancel_error", "lookup_error", "partial"]) {
      reset(); mode = scenario;
      const result = await AgentPaymentService.cancel(user, orderId, expected, randomUUID());
      assert.equal(result.status, "pending", "Chưa xác minh hủy thì vẫn giữ QR đang chờ.");
      assert(result.checkoutUrl); assert(!result.message.includes("Đã hủy giao dịch QR"));
      assert.equal(payment.status, "pending");
    }
    for (const scenario of ["PROCESSING", "PARTIAL"]) {
      reset(); link.status = scenario === "PROCESSING" ? scenario : "PENDING";
      link.amountPaid = scenario === "PARTIAL" ? 1000 : 0;
      await assert.rejects(execute); assert.equal(cancelCalls, 0); assert.equal(payment.status, "pending");
    }
    reset(); link.orderCode = 99999; await assert.rejects(execute, /không khớp/); assert.equal(cancelCalls, 0);
    reset(); const aborted = AbortSignal.abort();
    await assert.rejects(() => payments.cancelAgentPendingPayment(user, orderId, expected, actionId, aborted)); assert.equal(cancelCalls, 0);
    reset(); mode = "lost_response"; await execute(); assert.equal(payment.status, "failed");
    reset(); mode = "paid_during_cancel";
    const paid = await AgentPaymentService.cancel(user, orderId, expected, randomUUID());
    assert.equal(paid.status, "paid"); assert(!paid.message.includes("Đã hủy"));

    const registry = new ToolRegistry().register(cancelPaymentTool).register(getPaymentStatusTool);
    const loop = new AgentLoop({ generate: async () => { modelCalls++; throw Error("Không gọi model cho nút hủy QR"); } }, registry,
      { maxIterations: 1, systemPrompt: "Kiểm thử", timeoutMs: 5000 });
    const start = async () => {
      const session = newSession(randomUUID(), user.id);
      session.viewedOrder = { orderId, orderCode: order.orderCode };
      session.conversation.push({ id: randomUUID(), role: "tool", tool: "create_payment",
        content: JSON.stringify(await AgentPaymentService.status(user, orderId, false)), createdAt: new Date().toISOString() });
      const agent = new AgentService({ acquire: async () => ({ session, lockId: "khoa" }), save: async () => {}, release: async () => {} }, loop);
      const send = (message: string) => agent.send(user, session.id, { requestId: randomUUID(), message });
      const decide = (decision: "CONFIRM" | "REJECT") => agent.send(user, session.id, { requestId: randomUUID(),
        confirmation: { actionId: session.pendingAction!.id, decision } });
      return { session, agent, send, decide };
    };
    reset();
    const first = await start();
    await first.send("Hủy thanh toán");
    assert.equal(first.session.pendingAction?.tool, "cancel_payment"); assert.equal(cancelCalls, 0);
    await first.decide("REJECT"); assert.equal(cancelCalls, 0);
    assert.equal(sessionView(first.session).payment?.status, "pending");
    await first.send(`Hủy QR thanh toán đơn ${orderId}, giao dịch ${paymentId}.`);
    first.session.pendingAction!.expiresAt = new Date(Date.now() - 1).toISOString();
    await first.decide("CONFIRM"); assert.equal(cancelCalls, 0, "Form hết hạn cần xác nhận mới.");
    const request = { requestId: randomUUID(), confirmation: { actionId: first.session.pendingAction!.id, decision: "CONFIRM" as const } };
    const result = await first.agent.send(user, first.session.id, request);
    assert.equal(result.payment?.status, "failed"); assert.equal(result.payment?.checkoutUrl, undefined);
    await first.agent.send(user, first.session.id, request); assert.equal(cancelCalls, 1);
    first.session.conversation.push({ id: randomUUID(), role: "user", content: "Cảm ơn", createdAt: new Date().toISOString() });
    assert.notEqual(sessionView(first.session).payment?.status, "pending", "Không phục hồi QR cũ ở lượt sau.");
    const ambiguous = newSession(randomUUID(), user.id);
    ambiguous.viewedOrder = { orderId, orderCode: order.orderCode };
    ambiguous.bookingDraft = { status: "booked", revision: 1, values: {}, missing: [], summary: [], sources: {}, choiceGroups: [], orderId: replacementId };
    assert("error" in parseBookingHistoryRequest("Hủy thanh toán", ambiguous)!);
    assert.equal(parseBookingHistoryRequest("Hủy đơn này", ambiguous), undefined, "Không đánh đồng hủy đơn với hủy QR.");

    reset();
    const interrupted = await start();
    await interrupted.send("Hủy QR"); crashAfterWrite = true;
    await interrupted.decide("CONFIRM");
    assert(interrupted.session.requiresReconciliation);
    crashAfterWrite = false;
    const replacement = new Payment({ ...payment.toObject(), _id: replacementId, status: "pending", metadata: null });
    rows = [replacement, payment];
    await interrupted.agent.send(user, interrupted.session.id, { requestId: randomUUID(), paymentStatus: { orderId } });
    assert(interrupted.session.requiresReconciliation, "QR khác không phải bằng chứng hủy của lượt bị gián đoạn.");
    rows = [payment];
    await interrupted.agent.send(user, interrupted.session.id, { requestId: randomUUID(), paymentStatus: { orderId } });
    assert(!interrupted.session.requiresReconciliation); assert.equal(cancelCalls, 1);
    assert.equal(modelCalls, 0, "Nút hủy QR và câu hủy thanh toán được xử lý trực tiếp.");
    console.log("Đạt hủy QR: xác nhận/từ chối, giữ đơn, quyền sở hữu, QR cũ, trả tiền đồng thời, lỗi PayOS, không tạo giao dịch và khôi phục sau gián đoạn.");
  } finally {
    mock.restoreAll();
    if (originalGateway) require.cache[gatewayPath] = originalGateway;
    else delete require.cache[gatewayPath];
  }
}
void run().catch((error: unknown) => { console.error("Kiểm thử hủy QR thất bại.", error); process.exitCode = 1; });
