import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MemorySaver } from "@langchain/langgraph";
import { z } from "zod";
import type { AgentSession } from "../ai/agent/agent-state";
import { FixtureActionLedger } from "./fixtures/action-ledger.fixture";

class RefreshCrashSaver extends MemorySaver {
  crash = false;
  override async put(...args: Parameters<MemorySaver["put"]>) {
    const result = await super.put(...args);
    const data = args[1].channel_values.data as { session?: AgentSession } | undefined;
    if (this.crash && data?.session?.modelWorkflow?.phase === "refresh_sources" && data.session.modelWorkflow.refreshCursor === 1) {
      this.crash = false;
      throw new Error("Crash fixture sau lưu kết quả đọc lại.");
    }
    return result;
  }
}

async function run() {
  require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {}, payoutPayos: {} } } as NodeModule;
  const { CustomerWorkflowRuntime } = await import("../ai/runtime/customer-workflow-runtime");
  const { InProcessGraphPilotAccess } = await import("../ai/runtime/agent-runtime");
  const { ToolRegistry } = await import("../ai/tools/tool-registry");
  const { sessionView } = await import("../ai/agent/agent.service");
  const { newSession } = await import("../ai/agent/agent-state");
  const user = { id: "1".repeat(24), role: "CUSTOMER" as const };
  for (const mode of ["changed", "revoked", "failure", "disabled", "mutating", "crash"] as const) {
    const saver = new RefreshCrashSaver(), access = new InProcessGraphPilotAccess(), ledger = new FixtureActionLedger();
    let calls = 0, reads = 0, resumed = false;
    const makeRegistry = () => new ToolRegistry(mode === "disabled" && resumed ? { search_customer_knowledge: { enabled: false } } : {})
      .register({ name: "search_customer_knowledge", description: "Nguồn fixture có phiên bản.", roles: ["CUSTOMER"],
        mutates: mode === "mutating" && resumed, requiresConfirmation: false,
        preview: async () => ({}), inputSchema: z.object({ query: z.string() }).strict(),
        execute: async (context, args) => {
          reads++;
          assert.equal(context.user.id, user.id); assert.equal(args.query, "Chính sách");
          if (resumed) {
            assert.equal(context.readOnly, true);
            context.session!.currentGoal = "Không được áp đột biến từ tool đọc lên phiên chuẩn.";
            if (mode === "failure") throw new Error("Lỗi nguồn fixture.");
            return mode === "revoked" ? { sources: [] } : { sources: ["NEW_SOURCE_SENTINEL"] };
          }
          return { sources: ["OLD_SOURCE_SENTINEL"] };
        } });
    const runtime = () => new CustomerWorkflowRuntime({ registry: makeRegistry(), checkpointer: saver, access, ledger,
      assertWriteAccess: async () => {}, mergeMessages: async (session) => session,
      config: { maxIterations: 5, timeoutMs: 1000, systemPrompt: "Kiểm thử làm mới nguồn." },
      provider: { generate: async (request) => {
        calls++;
        if (calls === 1) return { type: "TOOL_CALL" as const, tool: "search_customer_knowledge", arguments: { query: "Chính sách" } };
        if (calls === 2) throw new DOMException("Timeout fixture.", "TimeoutError");
        const content = JSON.stringify(request);
        assert.ok(!content.includes("OLD_SOURCE_SENTINEL"), "Model không nhận kết quả cũ sau thử lại.");
        if (mode === "changed" || mode === "crash") assert.ok(content.includes("NEW_SOURCE_SENTINEL"));
        if (mode === "failure" || mode === "disabled" || mode === "mutating") assert.ok(content.includes("Chưa đọc lại được nguồn hiện tại"));
        return { type: "FINAL" as const, message: "Đã xử lý theo nguồn hiện tại." };
      } } });
    const id = randomUUID(), input = { requestId: randomUUID(), message: "Kiểm tra chính sách giúp tôi." };
    const paused = await runtime().send(user, id, input);
    assert.equal(paused.modelWorkflow?.readSources?.length, 1);
    assert.equal(paused.modelWorkflow?.waitingForModelRetry, true);
    resumed = true;
    if (mode === "crash") {
      saver.crash = true;
      await assert.rejects(runtime().send(user, id, input));
      assert.equal(reads, 2); assert.equal(calls, 2);
    }
    const done = await runtime().send(user, id, input);
    assert.equal(done.activeRequest, null);
    assert.equal(done.currentGoal, input.message, "Tool đọc lại chỉ nhận bản sao session.");
    assert.equal(reads, mode === "disabled" || mode === "mutating" ? 1 : 2);
    assert.equal(calls, 3);
    assert.ok(done.conversation.some((message) => message.supersededRead && message.content.includes("OLD_SOURCE_SENTINEL")),
      "Lịch sử gốc vẫn giữ để đối soát, chỉ loại khỏi ngữ cảnh model.");
    assert.equal(ledger.records.size, 0);
    await runtime().send(user, id, input); assert.equal(calls, 3);
  }
  const stalePayment = newSession(randomUUID(), user.id);
  stalePayment.conversation.push({ id: randomUUID(), role: "tool", tool: "get_payment_status", supersededRead: true,
    createdAt: new Date().toISOString(), content: JSON.stringify({ orderId: "2".repeat(24), orderCode: "HD-FIXTURE",
      status: "pending", message: "QR cũ", checkoutUrl: "https://pay.payos.vn/fixture" }) });
  assert.equal(sessionView(stalePayment).payment, null, "Không hiện QR cũ từ nguồn đã bị vô hiệu.");
  console.log("Đạt làm mới nguồn: dữ liệu đổi/thu hồi/lỗi, policy đổi, cấm tool ghi, snapshot lịch sử, session clone và crash sau checkpoint đọc lại.");
}
void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
