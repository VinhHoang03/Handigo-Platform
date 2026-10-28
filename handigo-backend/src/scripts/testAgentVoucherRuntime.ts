import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MemorySaver } from "@langchain/langgraph";
import { newSession, type AgentInput, type AgentSession } from "../ai/agent/agent-state";
import { FixtureActionLedger } from "./fixtures/action-ledger.fixture";

class VoucherSaver extends MemorySaver {
  puts = 0;
  fail?: { requestId: string; phase: "before" | "after" };
  override async put(...args: Parameters<MemorySaver["put"]>) {
    this.puts++;
    const data = args[1].channel_values.data as { session?: AgentSession } | undefined;
    const failure = this.fail && data?.session?.receipts.some((receipt) => receipt.requestId === this.fail!.requestId) ? this.fail : undefined;
    if (failure) delete this.fail;
    if (failure?.phase === "before") throw new Error("Mất checkpoint trước commit fixture.");
    const result = await super.put(...args);
    if (failure?.phase === "after") throw new Error("Mất phản hồi sau commit fixture.");
    return result;
  }
}

// Dùng graph và tool bản nháp thật, chỉ giả lập nguồn đọc/checkpoint; không dùng env hoặc cổng tiền.
async function run() {
  require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {}, payoutPayos: {} } } as NodeModule;
  const { CustomerWorkflowRuntime, buildCustomerSessionGraph } = await import("../ai/runtime/customer-workflow-runtime");
  const { InProcessGraphPilotAccess } = await import("../ai/runtime/agent-runtime");
  const { CUSTOMER_GRAPH_VERSION } = await import("../ai/runtime/mongo-graph-access");
  const { ToolRegistry } = await import("../ai/tools/tool-registry");
  const { createUpdateBookingDraftTool } = await import("../ai/tools/implementations/update-booking-draft.tool");
  const { updateBookingDraft } = await import("../ai/agent/booking-draft");
  const { bookingSchema } = await import("../ai/tools/implementations/booking.schemas");
  const { observeCustomerTurn } = await import("../ai/runtime/customer-runtime-metrics");
  const owner = { id: "1".repeat(24), role: "CUSTOMER" as const };
  const tomorrow = new Date(Date.now() + 3 * 86400000); tomorrow.setUTCHours(3, 0, 0, 0);
  let models = 0, writes = 0, lookups = 0, failPreview = false;
  const deps = {
    search: async () => [],
    service: async () => ({ id: "2".repeat(24), name: "Vệ sinh điều hòa", serviceType: "fixed_price", fixedPrice: 120000,
      requiresOptionSelection: false, options: [] }),
    addresses: async () => [{ id: "3".repeat(24), fullAddress: "Địa chỉ kiểm thử", province: "Đà Nẵng", ward: "Phường A", isDefault: true }],
    vouchers: async () => { lookups++; return [{ code: "GIAM10", name: "Giảm 10%", discountType: "PERCENT" as const,
      discountValue: 10, discountAmount: 12000, finalAmount: 108000 }]; },
  };
  const registry = new ToolRegistry().register(createUpdateBookingDraftTool(deps)).register({ name: "create_booking",
    description: "Bản xác nhận fixture.", roles: ["CUSTOMER"], inputSchema: bookingSchema, mutates: true, requiresConfirmation: true,
    preview: async (_context, args) => { if (failPreview) throw new Error("Lỗi đọc giá fixture.");
      return { amount: args.voucherCode ? 108000 : 120000, policyVersion: "a".repeat(64) }; },
    execute: async () => { writes++; throw new Error("Không được tạo đơn khi đổi mã."); },
  });
  async function fixture() {
    const id = randomUUID(), saver = new VoucherSaver(), access = new InProcessGraphPilotAccess();
    const session = newSession(id, owner.id); session.currentGoal = "Chuẩn bị đặt dịch vụ.";
    session.bookingDraft = await updateBookingDraft(undefined, { mode: "update", serviceId: "2".repeat(24),
      orderType: "scheduled", scheduledAt: tomorrow.toISOString() }, owner.id, deps);
    session.pendingAction = { id: randomUUID(), taskVersion: 0, tool: "create_booking", arguments: session.bookingDraft.values,
      preview: { amount: 120000, policyVersion: "a".repeat(64) }, status: "WAITING_CONFIRMATION",
      createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 600000).toISOString() };
    await access.exclusive(owner, id, (thread) => buildCustomerSessionGraph(saver).updateState({ configurable: { thread_id: thread } },
      { data: { version: CUSTOMER_GRAPH_VERSION, session } }, "session"));
    const runtime = () => new CustomerWorkflowRuntime({ registry, access, checkpointer: saver, ledger: new FixtureActionLedger(),
      assertWriteAccess: async () => {}, mergeMessages: async (candidate) => candidate,
      config: { maxIterations: 1, systemPrompt: "Fixture voucher.", timeoutMs: 1000 },
      provider: { generate: async () => { models++; throw new Error("Không gọi model khi chọn mã."); } } });
    const input = (voucherCode: string | null, revision = session.bookingDraft!.revision): AgentInput => ({ requestId: randomUUID(),
      message: voucherCode ? `Áp mã ${voucherCode}.` : "Không dùng voucher.", bookingAction: { type: "update", revision, patch: { voucherCode } } });
    const read = () => access.exclusive(owner, id, async (thread) =>
      structuredClone((await buildCustomerSessionGraph(saver).getState({ configurable: { thread_id: thread } })).values.data.session as AgentSession));
    return { id, saver, session, runtime, input, read };
  }
  const f = await fixture(), apply = f.input("GIAM10"), oldWrites = f.saver.puts;
  const selected = await observeCustomerTurn(() => f.runtime().send(owner, f.id, apply), (metric) => {
    assert.equal(metric.stages?.find((item) => item.stage === "checkpoint_write")?.count, 1);
  });
  assert.equal(f.saver.puts - oldWrites, 1, "Chỉ chốt một checkpoint cho đổi voucher.");
  assert.equal(selected.bookingDraft?.values.voucherCode, "GIAM10");
  assert.equal((selected.pendingAction?.preview as { amount: number }).amount, 108000);
  const reads = lookups;
  await f.runtime().send(owner, f.id, apply);
  assert.equal(lookups, reads, "Replay không đọc/tính lại voucher.");
  assert.equal(f.saver.puts - oldWrites, 1);
  const stale = await f.runtime().send(owner, f.id, f.input(null));
  assert.equal(stale.bookingDraft?.revision, selected.bookingDraft?.revision);
  assert.equal(stale.pendingAction?.id, selected.pendingAction?.id, "Tab cũ không làm mất form hiện hành.");
  const removed = await f.runtime().send(owner, f.id, f.input(null, selected.bookingDraft!.revision));
  assert.equal(removed.bookingDraft?.values.voucherCode, undefined);
  assert.equal((removed.pendingAction?.preview as { amount: number }).amount, 120000);
  assert.equal(removed.activeRequest, null);
  for (const phase of ["before", "after"] as const) {
    const crash = await fixture(), input = crash.input("GIAM10");
    crash.saver.fail = { requestId: input.requestId, phase };
    await assert.rejects(crash.runtime().send(owner, crash.id, input));
    const saved = await crash.read();
    assert.equal(saved.receipts.length, phase === "before" ? 0 : 1);
    const recovered = await crash.runtime().send(owner, crash.id, input);
    assert.equal(recovered.receipts.length, 1);
    assert.equal(recovered.bookingDraft?.revision, crash.session.bookingDraft!.revision + 1, "Crash không cập nhật draft hai lần.");
    assert.equal(recovered.bookingDraft?.values.voucherCode, "GIAM10");
  }
  const invalid = await fixture();
  const denied = await invalid.runtime().send(owner, invalid.id, invalid.input("KHONGHOPLE"));
  assert.equal(denied.pendingAction, null, "Mã không hợp lệ không sinh form có giá giảm.");
  assert.ok(denied.bookingDraft?.missing.length);
  const broken = await fixture(); failPreview = true;
  const failed = await broken.runtime().send(owner, broken.id, broken.input("GIAM10"));
  failPreview = false;
  assert.equal(failed.pendingAction, null);
  assert.ok(failed.recovery, "Lỗi preview giữ luồng phục hồi hiện có.");
  await assert.rejects(f.runtime().send({ ...owner, id: "9".repeat(24) }, f.id, f.input("GIAM10")));
  assert.equal(models, 0); assert.equal(writes, 0);
  console.log("Đạt cập nhật voucher nhanh: một checkpoint, không gọi model, chọn/bỏ mã, replay, tab cũ, crash trước/sau commit, lỗi giá/mã và ownership.");
}
void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
