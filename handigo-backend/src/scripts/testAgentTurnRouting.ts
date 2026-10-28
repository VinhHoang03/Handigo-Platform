import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MemorySaver } from "@langchain/langgraph";
import { z } from "zod";
import type { AgentSession } from "../ai/agent/agent-state";
import { FixtureActionLedger } from "./fixtures/action-ledger.fixture";

class TurnCrashSaver extends MemorySaver {
  crashOn?: "planned" | "updated";
  override async put(...args: Parameters<MemorySaver["put"]>) {
    const result = await super.put(...args);
    const data = args[1].channel_values.data as { session?: AgentSession } | undefined;
    const session = data?.session;
    const phase = session?.modelWorkflow?.phase;
    if (this.crashOn && ["history_request", "voucher_request"].includes(phase ?? "")
      && (this.crashOn === "planned" || session?.lastDraftRequest?.requestId === session?.activeRequest?.requestId)) {
      this.crashOn = undefined;
      throw new Error("Crash fixture sau checkpoint nhánh đặt lịch.");
    }
    return result;
  }
}

async function run() {
  require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {}, payoutPayos: {} } } as NodeModule;
  const { CustomerWorkflowRuntime, buildCustomerSessionGraph } = await import("../ai/runtime/customer-workflow-runtime");
  const { CUSTOMER_GRAPH_VERSION } = await import("../ai/runtime/mongo-graph-access");
  const { InProcessGraphPilotAccess } = await import("../ai/runtime/agent-runtime");
  const { ToolRegistry } = await import("../ai/tools/tool-registry");
  const { newSession } = await import("../ai/agent/agent-state");
  const user = { id: "1".repeat(24), role: "CUSTOMER" as const };
  for (const kind of ["ui", "voucher", "rebook", "restore"] as const) for (const crash of ["planned", "updated"] as const) {
    const id = randomUUID(), saver = new TurnCrashSaver(), access = new InProcessGraphPilotAccess();
    const seed = newSession(id, user.id);
    seed.taskVersion = 1;
    seed.currentGoal = "Đang chuẩn bị dịch vụ.";
    seed.bookingDraft = { status: "active", revision: 2, values: { serviceId: "2".repeat(24) }, sources: {},
      summary: [], missing: ["Thời gian"], choiceGroups: [{ label: "Thời gian", multiple: false, options: ["Chọn giờ"] }] };
    const proposalId = randomUUID(), backupId = randomUUID();
    seed.rebookProposal = { id: proposalId, revision: 2, taskVersion: 1, arguments: { orderId: "3".repeat(24), useSameProvider: false } };
    seed.draftBackup = { id: backupId, draft: structuredClone(seed.bookingDraft) };
    await access.exclusive(user, id, (thread) => buildCustomerSessionGraph(saver).updateState({ configurable: { thread_id: thread } },
      { data: { version: CUSTOMER_GRAPH_VERSION, session: seed } }, "session"));
    let updates = 0, models = 0;
    const registry = new ToolRegistry();
    for (const name of ["update_booking_draft", "rebook_booking"]) registry.register({ name, description: "Cập nhật draft fixture.",
      roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false, inputSchema: z.record(z.string(), z.unknown()),
      execute: async (context) => {
        if (kind === "rebook") assert.equal(context.replaceBookingDraft, true, "Quyết định đổi draft được giữ qua checkpoint.");
        updates++; context.session!.bookingDraft!.revision++;
        return { revision: context.session!.bookingDraft!.revision };
      } });
    const runtime = () => new CustomerWorkflowRuntime({ registry, access, checkpointer: saver, ledger: new FixtureActionLedger(),
      assertWriteAccess: async () => {}, mergeMessages: async (session) => session,
      config: { maxIterations: 2, timeoutMs: 1000, systemPrompt: "Kiểm thử nhánh nghiệp vụ." },
      provider: { generate: async () => { models++; throw new Error("Nhánh xác định không cần gọi model."); } } });
    const bookingAction = kind === "ui" ? { type: "update" as const, revision: 2, patch: { paymentMethod: "wallet" as const } }
      : kind === "rebook" ? { type: "rebook_decision" as const, proposalId, accept: true }
        : kind === "restore" ? { type: "restore_draft" as const, backupId } : undefined;
    const input = { requestId: randomUUID(), message: kind === "voucher" ? "Áp mã COC10" : "Cập nhật thông tin đã chọn.",
      ...(bookingAction ? { bookingAction } : {}) };
    saver.crashOn = crash;
    await assert.rejects(runtime().send(user, id, input));
    const result = await runtime().send(user, id, input);
    assert.equal(updates, 1, `${kind}/${crash}: không cập nhật draft hai lần`);
    assert.equal(models, 0);
    assert.equal(result.bookingDraft?.revision, kind === "restore" ? 4 : 3);
    assert.equal(result.taskVersion, kind === "restore" ? 2 : 1);
    assert.equal(result.state, "WAITING_USER_INPUT");
    assert.equal(result.receipts.length, 1); assert.equal(result.activeRequest, null);
    await runtime().send(user, id, input); assert.equal(updates, 1);
  }
  console.log("Đạt nhánh graph: UI/voucher/đặt lại/khôi phục, lưu kế hoạch, crash trước/sau cập nhật, revision/taskVersion, không gọi model hoặc ghi lặp.");
}
void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
