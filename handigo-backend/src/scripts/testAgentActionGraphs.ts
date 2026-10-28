import assert from "node:assert/strict";
import { mock } from "node:test";
import { z } from "zod";
import { newSession, type PendingAction } from "../ai/agent/agent-state";
import { buildBookingActionGraph, buildBookingDraftGraph, BOOKING_WRITE_TOOLS } from "../ai/graphs/booking.graph";
import { createUpdateBookingDraftTool } from "../ai/tools/implementations/update-booking-draft.tool";
import { bookingSchema } from "../ai/tools/implementations/booking.schemas";
import { buildPaymentActionGraph, reconcileGraphPayment, reconcileGraphPaymentCancellation } from "../ai/graphs/payment.graph";
import { AgentPaymentService, type AgentPaymentResult } from "../services/agentPayment.service";
import { buildCustomerCareActionGraph } from "../ai/graphs/customer-care.graph";
import { prepareDomainAction } from "../ai/graphs/confirmed-action.graph";
import { requireActionMatch, type ActionIdentity, type ActionLedger, type ActionRecord } from "../ai/runtime/action-ledger";
import { ToolRegistry } from "../ai/tools/tool-registry";
import type { ToolContext } from "../ai/tools/tool.interface";
import { ActionPreconditionError } from "../utils/actionPreconditionError";
import { AgentLoop } from "../ai/agent/agent-loop.service";
import { ActionGraphDispatcher } from "../ai/runtime/action-graph-dispatcher";

// Chỉ là kho giả lập cho các ca kiểm thử; không dùng ở runtime phục vụ khách.
class Ledger implements ActionLedger {
  records = new Map<string, ActionRecord>();
  lostReserve = false;
  lostResult = false;
  async find(identity: ActionIdentity) {
    const record = this.records.get(identity.id);
    if (!record) return null;
    requireActionMatch(identity, record);
    return structuredClone(record);
  }
  async reserve(identity: ActionIdentity) {
    const previous = await this.find(identity);
    if (previous) return { record: previous, inserted: false };
    // Không await giữa kiểm tra slot và insert để mô phỏng unique index nguyên tử.
    const raced = this.records.get(identity.id);
    if (raced) { requireActionMatch(identity, raced); return { record: structuredClone(raced), inserted: false }; }
    if ([...this.records.values()].some((item) => item.active && item.userId === identity.userId && item.sessionId === identity.sessionId)) {
      throw new Error("Còn hành động chưa rõ kết quả.");
    }
    const record: ActionRecord = { ...identity, status: "EXECUTING", active: true, startedAt: new Date().toISOString() };
    this.records.set(identity.id, record);
    if (this.lostReserve) throw new Error("Mất phản hồi sau lưu ý định.");
    return { record: structuredClone(record), inserted: true };
  }
  async settle(identity: ActionIdentity, status: "UNKNOWN" | "SUCCEEDED" | "EXPIRED", result?: unknown) {
    const record = this.records.get(identity.id)!;
    requireActionMatch(identity, record);
    if (!["SUCCEEDED", "EXPIRED"].includes(record.status)) {
      Object.assign(record, { status, active: status === "UNKNOWN", ...(result !== undefined ? { result } : {}) });
    }
    if (this.lostResult && status === "SUCCEEDED") throw new Error("Mất phản hồi sau lưu kết quả.");
    return structuredClone(record);
  }
}

function fixture(toolName = "create_booking") {
  const ledger = new Ledger();
  const session = newSession("phien-ghi", "khach-ghi");
  const counters = { writes: 0, reads: 0, previews: 0 };
  let changed = false;
  let failure: "unknown" | "precondition" | undefined;
  let businessResult: unknown = null;
  const preview = { amount: 100000, policyVersion: "chinh-sach-1" };
  const registry = new ToolRegistry().register({ name: toolName, description: "Thao tác ghi kiểm thử.",
    inputSchema: z.object({ orderId: z.string() }).strict(), mutates: true, requiresConfirmation: true, roles: ["CUSTOMER"],
    preview: async () => { counters.previews++; return { ...preview, amount: changed ? 120000 : 100000 }; },
    execute: async (context) => {
      counters.writes++;
      assert.ok(context.actionId);
      assert.ok(context.actionCreatedAt);
      assert.deepEqual(context.confirmedPreview, preview);
      if (failure === "precondition") throw new ActionPreconditionError("Chưa có chuyên gia phù hợp với dịch vụ và địa chỉ đã chọn.");
      businessResult = { orderId: "a".repeat(24), orderCode: "HD001", message: "Đã xử lý yêu cầu." };
      if (failure === "unknown") throw new Error("Mất phản hồi sau ghi nghiệp vụ.");
      return businessResult;
    },
    reconcile: async () => { counters.reads++; return businessResult; },
  });
  const action: PendingAction = { id: "xac-nhan-1", taskVersion: 0, tool: toolName, arguments: { orderId: "a".repeat(24) },
    preview, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(), status: "WAITING_CONFIRMATION",
    ...(toolName === "create_booking" ? { policyConsent: { version: "chinh-sach-1", acceptedAt: new Date().toISOString(), actionId: "xac-nhan-1" } } : {}),
  };
  session.pendingAction = action;
  session.activeRequest = { requestId: "yeu-cau-ghi", digest: "digest-yeu-cau", input: {
    requestId: "yeu-cau-ghi", confirmation: { actionId: action.id, decision: "CONFIRM" },
  } };
  const context: ToolContext = { user: { id: session.userId, role: "CUSTOMER" }, sessionId: session.id,
    signal: AbortSignal.timeout(10000) };
  const deps = { registry, ledger, context, assertWriteAccess: async () => {} };
  const build = () => toolName.includes("payment") || toolName === "reject_booking_quotation" ? buildPaymentActionGraph(deps)
    : toolName.includes("support") || toolName.includes("complaint") || toolName.includes("feedback") ? buildCustomerCareActionGraph(deps)
      : buildBookingActionGraph(deps);
  return { ledger, session, action, deps, counters, build, change: () => { changed = true; },
    fail: (value: typeof failure) => { failure = value; }, forgetResult: () => { businessResult = null; } };
}

async function run() {
  const f = fixture();
  const success = await f.build().invoke({ data: { session: f.session, action: f.action } });
  assert.equal(success.data.action.status, "SUCCEEDED");
  assert.equal(success.data.session.requiresReconciliation, false);
  assert.equal(success.data.session.conversation.filter((item) => item.role === "tool").length, 1);
  const replay = await f.build().invoke({ data: { session: success.data.session, action: f.action } });
  assert.equal(f.counters.writes, 1);
  assert.equal(f.counters.reads, 0);
  assert.equal(replay.data.session.actions.length, 1);
  assert.equal(replay.data.session.conversation.length, 1);
  assert.equal(replay.data.session.progress.length, 1);
  // Đổi thứ tự key JSON không làm đổi ý nghĩa; sửa nội dung/preview phải bị chặn.
  const reordered = structuredClone(f.action);
  reordered.preview = { policyVersion: "chinh-sach-1", amount: 100000 };
  await f.build().invoke({ data: { session: success.data.session, action: reordered } });
  for (const patch of [{ preview: { amount: 1 } }, { arguments: { orderId: "khac" } }, { taskVersion: 1 }]) {
    await assert.rejects(f.build().invoke({ data: { session: success.data.session, action: { ...f.action, ...patch } } }));
  }

  const race = fixture();
  const shared = race.build();
  await Promise.all([shared.invoke({ data: { session: race.session, action: race.action } }),
    shared.invoke({ data: { session: race.session, action: race.action } })]);
  assert.equal(race.counters.writes, 1);

  const interrupted = fixture();
  interrupted.fail("unknown");
  const unknown = await interrupted.build().invoke({ data: { session: interrupted.session, action: interrupted.action } });
  assert.equal(unknown.data.action.status, "UNKNOWN");
  assert.equal(unknown.data.session.requiresReconciliation, true);
  const recovered = await interrupted.build().invoke({ data: { session: unknown.data.session, action: interrupted.action } });
  assert.equal(recovered.data.action.status, "SUCCEEDED");
  assert.equal(interrupted.counters.writes, 1);
  assert.equal(interrupted.counters.reads, 1);

  const unresolved = fixture();
  unresolved.fail("unknown");
  const paused = await unresolved.build().invoke({ data: { session: unresolved.session, action: unresolved.action } });
  unresolved.forgetResult();
  const stillPaused = await unresolved.build().invoke({ data: { session: paused.data.session, action: unresolved.action } });
  assert.equal(stillPaused.data.session.requiresReconciliation, true);
  assert.equal(unresolved.counters.writes, 1);
  const different = { ...unresolved.action, id: "xac-nhan-khac" };
  await assert.rejects(unresolved.build().invoke({ data: { session: paused.data.session, action: different } }));

  const lostIntent = fixture();
  lostIntent.ledger.lostReserve = true;
  await assert.rejects(lostIntent.build().invoke({ data: { session: lostIntent.session, action: lostIntent.action } }));
  const noWrite = await lostIntent.build().invoke({ data: { session: lostIntent.session, action: lostIntent.action } });
  assert.equal(noWrite.data.session.requiresReconciliation, true);
  assert.equal(lostIntent.counters.writes, 0);

  const lostResult = fixture();
  lostResult.ledger.lostResult = true;
  await assert.rejects(lostResult.build().invoke({ data: { session: lostResult.session, action: lostResult.action } }));
  const restored = await lostResult.build().invoke({ data: { session: lostResult.session, action: lostResult.action } });
  assert.equal(restored.data.action.status, "SUCCEEDED");
  assert.equal(lostResult.counters.writes, 1);

  for (const mutate of [
    (v: ReturnType<typeof fixture>) => { v.change(); },
    (v: ReturnType<typeof fixture>) => { v.action.policyConsent = undefined; },
    (v: ReturnType<typeof fixture>) => { v.action.expiresAt = new Date(0).toISOString(); },
    (v: ReturnType<typeof fixture>) => { v.session.taskVersion++; },
    (v: ReturnType<typeof fixture>) => { v.session.activeRequest = null; },
    (v: ReturnType<typeof fixture>) => { v.deps.context.user = { id: "nguoi-khac", role: "CUSTOMER" }; },
    (v: ReturnType<typeof fixture>) => { v.deps.context.readOnly = true; },
  ]) {
    const denied = fixture(); mutate(denied);
    await assert.rejects(denied.build().invoke({ data: { session: denied.session, action: denied.action } }));
    assert.equal(denied.counters.writes, 0);
    assert.equal(denied.ledger.records.size, 0);
  }
  const precondition = fixture(); precondition.fail("precondition");
  const expired = await precondition.build().invoke({ data: { session: precondition.session, action: precondition.action } });
  assert.equal(expired.data.action.status, "EXPIRED");
  assert.equal(expired.data.preconditionMessage, "Chưa có chuyên gia phù hợp với dịch vụ và địa chỉ đã chọn.");
  await precondition.build().invoke({ data: { session: expired.data.session, action: precondition.action } });
  assert.equal(precondition.counters.writes, 1);
  const unavailable = fixture(); unavailable.fail("precondition");
  const loop = new AgentLoop({ generate: async () => { throw new Error("Không gọi model khi báo điều kiện tạo đơn."); } },
    unavailable.deps.registry, { maxIterations: 1, timeoutMs: 10000, systemPrompt: "" },
    new ActionGraphDispatcher(unavailable.deps.registry, unavailable.ledger, unavailable.deps.assertWriteAccess));
  await loop.executeActionGraph(unavailable.session, unavailable.deps.context, unavailable.action, async () => {});
  assert.equal(unavailable.session.conversation.filter((message) => message.role === "assistant").slice(-1)[0]?.content,
    "Chưa có chuyên gia phù hợp với dịch vụ và địa chỉ đã chọn.");
  assert.equal(unavailable.session.requiresReconciliation, false);
  assert.equal(unavailable.session.pendingAction, null);
  assert.ok(Date.parse(unavailable.action.expiresAt) > Date.now(), "Lý do nghiệp vụ phải được giữ ngay cả khi form còn hạn.");
  const lostLease = fixture();
  let leaseChecks = 0;
  lostLease.deps.assertWriteAccess = async () => { if (++leaseChecks > 1) throw new Error("Đã mất lease trước khi ghi nghiệp vụ."); };
  const leaseStopped = await lostLease.build().invoke({ data: { session: lostLease.session, action: lostLease.action } });
  assert.equal(leaseStopped.data.session.requiresReconciliation, true);
  assert.equal(lostLease.counters.writes, 0);

  // Cả ba graph đều qua cùng executor; không cho tên tool ngoài nghiệp vụ vượt cổng.
  for (const name of ["create_payment", "cancel_payment", "reject_booking_quotation", "create_support_ticket", "reply_support_ticket",
    "create_complaint", "add_complaint_evidence", "submit_booking_feedback", "cancel_booking", "select_order_provider"] ) {
    const v = fixture(name);
    const result = await v.build().invoke({ data: { session: v.session, action: v.action } });
    assert.equal(result.data.action.status, "SUCCEEDED", name);
    await v.build().invoke({ data: { session: result.data.session, action: v.action } });
    assert.equal(v.counters.writes, 1, name);
  }
  const wrongDomain = fixture("create_payment");
  await assert.rejects(buildBookingActionGraph(wrongDomain.deps).invoke({ data: { session: wrongDomain.session, action: wrongDomain.action } }));
  const prepare = fixture(); prepare.session.pendingAction = null;
  const proposed = await prepareDomainAction("booking", BOOKING_WRITE_TOOLS, prepare.deps, prepare.session, "create_booking", prepare.action.arguments);
  assert.equal(proposed.status, "WAITING_CONFIRMATION");
  assert.equal(proposed.taskVersion, prepare.session.taskVersion);
  assert.equal(prepare.counters.writes, 0);
  const draftSession = newSession("phien-ban-nhap-graph", "khach-ban-nhap");
  draftSession.activeRequest = { requestId: "sua-ban-nhap", digest: "digest-ban-nhap", input: {
    requestId: "sua-ban-nhap", message: "Đặt dịch vụ và hẹn giờ." } };
  const serviceId = "b".repeat(24), addressId = "c".repeat(24);
  const draftRegistry = new ToolRegistry().register(createUpdateBookingDraftTool({
    search: async () => [{ id: serviceId, name: "Vệ sinh nhà" }],
    service: async () => ({ id: serviceId, name: "Vệ sinh nhà", serviceType: "fixed_price", fixedPrice: 100000,
      requiresOptionSelection: false, options: [] }),
    addresses: async () => [{ id: addressId, fullAddress: "12 Lê Lợi", ward: "Phường A", province: "Đà Nẵng", isDefault: true }],
  })).register({ name: "create_booking", description: "Chuẩn bị xác nhận đặt đơn.", inputSchema: bookingSchema,
    roles: ["CUSTOMER"], mutates: true, requiresConfirmation: true, preview: async () => ({ amount: 100000, policyVersion: "v1" }),
    execute: async () => { throw new Error("Graph bản nháp không được tạo đơn."); },
  });
  const draftContext: ToolContext = { user: { id: draftSession.userId, role: "CUSTOMER" }, sessionId: draftSession.id, signal: AbortSignal.timeout(10000) };
  const draftGraph = buildBookingDraftGraph({ registry: draftRegistry, context: draftContext });
  const when = new Date(Date.now() + 3 * 86400000); when.setUTCHours(3, 0, 0, 0);
  const drafted = await draftGraph.invoke({ data: { session: draftSession, expectedRevision: null,
    patch: { mode: "update", serviceId, addressId, orderType: "scheduled", scheduledAt: when.toISOString(), paymentMethod: "cash" } } });
  assert.equal(drafted.data.session.state, "WAITING_CONFIRMATION");
  assert.equal(drafted.data.session.pendingAction?.tool, "create_booking");
  assert.equal(drafted.data.session.actions.length, 0);
  assert.equal(draftSession.bookingDraft, undefined, "Không sửa state bên ngoài graph trước khi caller lưu checkpoint.");
  const edited = await draftGraph.invoke({ data: { session: drafted.data.session,
    expectedRevision: drafted.data.session.bookingDraft!.revision, patch: { mode: "update", quantity: 2 } } });
  assert.equal(edited.data.session.actions[0].status, "EXPIRED");
  assert.notEqual(edited.data.session.pendingAction?.id, drafted.data.session.pendingAction?.id);
  assert.equal(edited.data.session.bookingDraft?.values.addressId, addressId);
  await assert.rejects(draftGraph.invoke({ data: { session: edited.data.session,
    expectedRevision: -1, patch: { mode: "update", quantity: 3 } } }));
  const pausedDraft = await draftGraph.invoke({ data: { session: edited.data.session,
    expectedRevision: edited.data.session.bookingDraft!.revision, patch: { mode: "pause" } } });
  assert.equal(pausedDraft.data.session.bookingDraft?.status, "paused");
  assert.equal(pausedDraft.data.session.pendingAction, null);
  let payment: AgentPaymentResult = { orderId: "a".repeat(24), orderCode: "HD001", paymentId: "d".repeat(24),
    status: "paid", amount: 100000, method: "wallet", paymentType: "full", message: "Đã thanh toán." };
  const statusMock = mock.method(AgentPaymentService, "status", async () => payment);
  let cancellationVerified = false;
  const cancellationMock = mock.method(AgentPaymentService, "cancellationConfirmed", async (_user: ToolContext["user"], current: AgentPaymentResult, paymentId: string) =>
    cancellationVerified && current.paymentId === paymentId);
  try {
    const paymentContext = { ...f.deps.context, confirmedPreview: { amount: 100000, paymentType: "full", paymentId: payment.paymentId } };
    const paymentArgs = { orderId: payment.orderId, method: "WALLET" };
    assert.equal((await reconcileGraphPayment(paymentContext, paymentArgs) as AgentPaymentResult).status, "paid");
    for (const patch of [{ amount: 1 }, { method: "payos" }, { paymentType: "inspection_deposit" },
      { status: "unpaid" as const }, { status: "pending" as const, checkoutUrl: undefined }]) {
      const before = payment; payment = { ...payment, ...patch };
      assert.equal(await reconcileGraphPayment(paymentContext, paymentArgs), null);
      payment = before;
    }
    assert.equal(await reconcileGraphPaymentCancellation(paymentContext, paymentArgs), null);
    cancellationVerified = true;
    assert.ok(await reconcileGraphPaymentCancellation(paymentContext, paymentArgs));
    assert.equal(await reconcileGraphPaymentCancellation({ ...paymentContext,
      confirmedPreview: { amount: 100000, paymentType: "full", paymentId: "e".repeat(24) } }, paymentArgs), null);
  } finally { statusMock.mock.restore(); cancellationMock.mock.restore(); }
  console.log("Đạt: graph G4/G5 xác nhận, tranh chạy, replay, đối soát và mất phản hồi; không gọi dịch vụ ngoài.");
}
void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
