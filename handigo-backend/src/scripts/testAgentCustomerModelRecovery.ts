import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MemorySaver } from "@langchain/langgraph";
import { z } from "zod";
import type { AgentSession } from "../ai/agent/agent-state";
import { ProviderHttpError } from "../ai/llm/providers/provider-http";
import { FixtureActionLedger } from "./fixtures/action-ledger.fixture";

class PauseCrashSaver extends MemorySaver {
  crash?: "before" | "after";
  override async put(...args: Parameters<MemorySaver["put"]>) {
    const data = args[1].channel_values.data as { session?: AgentSession } | undefined;
    const pause = data?.session?.modelWorkflow?.waitingForModelRetry && this.crash;
    if (pause === "before") { this.crash = undefined; throw new Error("Crash fixture trước lưu chờ model."); }
    const result = await super.put(...args);
    if (pause === "after") { this.crash = undefined; throw new Error("Crash fixture sau lưu chờ model."); }
    return result;
  }
}

async function run() {
  require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {}, payoutPayos: {} } } as NodeModule;
  const { CustomerWorkflowRuntime } = await import("../ai/runtime/customer-workflow-runtime");
  const { InProcessGraphPilotAccess } = await import("../ai/runtime/agent-runtime");
  const { ToolRegistry } = await import("../ai/tools/tool-registry");
  const { sessionView } = await import("../ai/agent/agent.service");
  const user = { id: "1".repeat(24), role: "CUSTOMER" as const };
  const timeout = () => new DOMException("Timeout fixture.", "TimeoutError");
  for (const failure of [timeout(), ...[408, 429, 500, 502, 503, 504].map((status) => new ProviderHttpError(status))]) {
    for (const afterRead of [false, true]) {
      const saver = new MemorySaver(), ledger = new FixtureActionLedger(), access = new InProcessGraphPilotAccess();
      let calls = 0, reads = 0, fail = true;
      const registry = new ToolRegistry().register({ name: "get_service", description: "Đọc fixture.", roles: ["CUSTOMER"],
        mutates: false, requiresConfirmation: false, inputSchema: z.object({}).strict(),
        execute: async () => { reads++; return { name: "Vệ sinh", serviceType: "fixed_price" }; } });
      const runtime = () => new CustomerWorkflowRuntime({ registry, ledger, access, checkpointer: saver,
        assertWriteAccess: async () => {}, mergeMessages: async (session) => session,
        config: { maxIterations: 4, timeoutMs: 1000, systemPrompt: "Kiểm thử tiếp tục model." },
        provider: { generate: async () => {
          calls++;
          if (afterRead && calls === 1) return { type: "TOOL_CALL" as const, tool: "get_service", arguments: {} };
          if (fail) throw failure;
          return { type: "FINAL" as const, message: "Đã hoàn tất lượt đang dở." };
        } } });
      const id = randomUUID(), input = { requestId: randomUUID(), message: "Kiểm tra thông tin dịch vụ giúp tôi." };
      const paused = await runtime().send(user, id, input);
      assert.equal(paused.state, "FAILED");
      assert.equal(paused.modelWorkflow?.waitingForModelRetry, true);
      assert.equal(paused.receipts.length, 0);
      assert.deepEqual(sessionView(paused).interruptedRequest, input);
      const countAtPause = calls;
      await assert.rejects(runtime().send(user, id, { ...input, message: "Nội dung khác." }));
      await assert.rejects(runtime().send(user, id, { ...input, requestId: randomUUID() }));
      await assert.rejects(runtime().send({ ...user, id: "9".repeat(24) }, id, input));
      await assert.rejects(runtime().send({ ...user, role: "PROVIDER" }, id, input));
      await assert.rejects(runtime().registerAttachment(user, id, "https://example.invalid/anh.jpg"));
      assert.equal(calls, countAtPause);
      fail = false;
      const done = await runtime().send(user, id, input);
      assert.equal(done.activeRequest, null); assert.equal(done.receipts.length, 1);
      assert.equal(done.modelWorkflow, undefined);
      assert.equal(done.conversation.filter((item) => item.role === "user").length, 1);
      assert.equal(reads, afterRead ? 2 : 0, "Chỉ đọc lại nguồn khi tiếp tục model sau gián đoạn.");
      await runtime().send(user, id, input);
      assert.equal(calls, countAtPause + 1);
      assert.equal(ledger.records.size, 0);
    }
  }
  for (const crash of ["before", "after"] as const) {
    const saver = new PauseCrashSaver(), access = new InProcessGraphPilotAccess();
    let fail = true, calls = 0;
    const runtime = () => new CustomerWorkflowRuntime({ registry: new ToolRegistry(), ledger: new FixtureActionLedger(), access,
      checkpointer: saver, assertWriteAccess: async () => {}, mergeMessages: async (session) => session,
      config: { maxIterations: 4, timeoutMs: 1000, systemPrompt: "Kiểm thử crash model." },
      provider: { generate: async () => { calls++; if (fail) throw timeout(); return { type: "FINAL" as const, message: "Đã tiếp tục." }; } } });
    saver.crash = crash;
    const id = randomUUID(), input = { requestId: randomUUID(), message: "Xem thông tin giúp tôi." };
    await assert.rejects(runtime().send(user, id, input));
    fail = false;
    const done = await runtime().send(user, id, input);
    assert.equal(calls, 2); assert.equal(done.activeRequest, null); assert.equal(done.receipts.length, 1);
    assert.equal(done.conversation.filter((item) => item.role === "user").length, 1);
  }
  for (const status of [404, 429]) {
    const access = new InProcessGraphPilotAccess(), saver = new MemorySaver();
    let calls = 0;
    const runtime = () => new CustomerWorkflowRuntime({ registry: new ToolRegistry(), ledger: new FixtureActionLedger(), access,
      checkpointer: saver, assertWriteAccess: async () => {}, mergeMessages: async (session) => session,
      config: { maxIterations: 2, timeoutMs: 1000, systemPrompt: "Kiểm thử giới hạn thử." },
      provider: { generate: async () => { calls++; throw new ProviderHttpError(status); } } });
    const id = randomUUID(), input = { requestId: randomUUID(), message: "Cho tôi thông tin." };
    let result = await runtime().send(user, id, input);
    if (status === 429) {
      assert.ok(result.activeRequest); result = await runtime().send(user, id, input);
    }
    assert.equal(result.activeRequest, null); assert.equal(result.receipts.length, 1);
    await runtime().send(user, id, input);
    assert.equal(calls, status === 404 ? 1 : 2);
  }
  {
    let calls = 0;
    const access = new InProcessGraphPilotAccess(), saver = new MemorySaver();
    const runtime = () => new CustomerWorkflowRuntime({ registry: new ToolRegistry(), ledger: new FixtureActionLedger(), access,
      checkpointer: saver, assertWriteAccess: async () => {}, mergeMessages: async (session) => session,
      config: { maxIterations: 3, timeoutMs: 10, systemPrompt: "Kiểm thử hủy thật." },
      provider: { generate: async ({ signal }) => {
        calls++;
        if (calls === 1) await new Promise<never>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
        return { type: "FINAL" as const, message: "Đã tiếp tục sau timeout thật." };
      } } });
    const id = randomUUID(), input = { requestId: randomUUID(), message: "Kiểm tra yêu cầu này." };
    // AbortSignal.timeout không giữ event loop; watchdog giúp ca test không thoát sớm khi đang await.
    const watchdog = setTimeout(() => { throw new Error("Ca hủy model không kết thúc đúng hạn."); }, 1000);
    try {
      const paused = await runtime().send(user, id, input);
      assert.equal(paused.modelWorkflow?.waitingForModelRetry, true);
      assert.equal(paused.receipts.length, 0);
    } finally { clearTimeout(watchdog); }
    const done = await runtime().send(user, id, input);
    assert.equal(done.activeRequest, null); assert.equal(calls, 2);
  }
  // Timeout sau service ghi thành công: retry model không tiêu thụ xác nhận hoặc chạy service lần nữa.
  {
    const access = new InProcessGraphPilotAccess(), saver = new MemorySaver(), ledger = new FixtureActionLedger();
    let writes = 0, calls = 0;
    const registry = new ToolRegistry().register({ name: "cancel_booking", description: "Hủy fixture sau xác nhận.",
      roles: ["CUSTOMER"], mutates: true, requiresConfirmation: true, inputSchema: z.object({ orderId: z.string() }).strict(),
      preview: async () => ({ paidAmount: 0, refundAmount: 0, cancellationFee: 0 }),
      execute: async () => { writes++; return { message: "Đã xử lý fixture." }; } });
    const runtime = () => new CustomerWorkflowRuntime({ registry, ledger, access, checkpointer: saver,
      assertWriteAccess: async () => {}, mergeMessages: async (session) => session,
      config: { maxIterations: 4, timeoutMs: 1000, systemPrompt: "Kiểm thử model sau ghi." },
      provider: { generate: async () => {
        calls++;
        if (calls === 1) return { type: "TOOL_CALL" as const, tool: "cancel_booking", arguments: { orderId: "2".repeat(24) } };
        if (calls === 2) throw timeout();
        return { type: "FINAL" as const, message: "Đã kiểm tra kết quả hủy." };
      } } });
    const id = randomUUID();
    const preview = await runtime().send(user, id, { requestId: randomUUID(), message: "Tôi muốn hủy dịch vụ đã chọn." });
    const confirm = { requestId: randomUUID(), confirmation: { actionId: preview.pendingAction!.id, decision: "CONFIRM" as const } };
    const paused = await runtime().send(user, id, confirm);
    assert.equal(writes, 1); assert.deepEqual(sessionView(paused).interruptedRequest, confirm);
    assert.equal(paused.modelWorkflow?.waitingForModelRetry, true);
    const done = await runtime().send(user, id, confirm);
    assert.equal(writes, 1); assert.equal(calls, 3); assert.equal(done.activeRequest, null);
    assert.equal(done.actions.filter((item) => item.status === "SUCCEEDED").length, 1);
    assert.ok([...ledger.records.values()].every((item) => !item.active));
    await runtime().send(user, id, confirm); assert.equal(calls, 3); assert.equal(writes, 1);
  }
  console.log("Đạt phục hồi model engine giao dịch: timeout/HTTP tạm thời, trước/sau đọc và sau ghi, request/owner, crash checkpoint, giới hạn thử, 404 và replay.");
}
void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
