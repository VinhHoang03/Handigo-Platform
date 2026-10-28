import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createCustomerGraphConnection } from "../ai/runtime/customer-graph-connection";
import type { ActionLedger } from "../ai/runtime/action-ledger";
import type { AgentSession } from "../ai/agent/agent-state";

export async function verifyAgentCustomerGraphAtlas(uri: string) {
  // Chặn khởi tạo PayOS trước khi tải orchestration dùng chung; ca này không gọi service nghiệp vụ.
  require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {}, payoutPayos: {} } } as NodeModule;
  const { CustomerWorkflowRuntime } = await import("../ai/runtime/customer-workflow-runtime");
  const { ToolRegistry } = await import("../ai/tools/tool-registry");
  const first = createCustomerGraphConnection(uri), second = createCustomerGraphConnection(uri);
  const user = { id: "f".repeat(24), role: "CUSTOMER" as const }, id = randomUUID();
  let fixtureExecutions = 0, modelCalls = 0;
  const registry = new ToolRegistry().register({ name: "create_support_ticket", description: "Hành động fixture chỉ ghi ledger AI.",
    inputSchema: z.object({ subject: z.string() }).strict(), mutates: true, requiresConfirmation: true, roles: ["CUSTOMER"],
    preview: async () => ({ subject: "KIỂM THỬ ENGINE NGHIỆP VỤ — không gửi hỗ trợ thật" }),
    execute: async () => { fixtureExecutions++; return { fixture: true, message: "Kết quả fixture, không tạo hồ sơ nghiệp vụ." }; },
    reply: () => ({ state: "COMPLETED", message: "Đã hoàn tất fixture AI, không có hồ sơ hỗ trợ thật." }),
  });
  try {
    await first.setup();
    await first.open();
    await second.open();
    let loseResult = true;
    const ledger: ActionLedger = {
      find: (identity) => first.ledger.find(identity), reserve: (identity) => first.ledger.reserve(identity),
      async settle(identity, status, result) {
        const record = await first.ledger.settle(identity, status, result);
        if (status === "SUCCEEDED" && loseResult) { loseResult = false; throw new Error("Mất phản hồi fixture sau ghi ledger."); }
        return record;
      },
    };
    const runtime = (connection: typeof first, store = connection.ledger as ActionLedger) => new CustomerWorkflowRuntime({
      registry, ledger: store, access: connection.access, checkpointer: connection.saver, assertWriteAccess: connection.assertWriteAccess,
      config: { maxIterations: 1, timeoutMs: 2000, systemPrompt: "Chỉ chạy fixture AI." },
      mergeMessages: async (session: AgentSession) => session,
      provider: { generate: async () => { modelCalls++; return { type: "TOOL_CALL", tool: "create_support_ticket", arguments: { subject: "Fixture AI" } }; } },
    });
    const prepared = await runtime(first, ledger).send(user, id, { requestId: randomUUID(), message: "KIỂM THỬ ENGINE NGHIỆP VỤ, chỉ dữ liệu AI." });
    assert.equal(prepared.pendingAction?.status, "WAITING_CONFIRMATION");
    assert.equal((await second.get(id, user.id)).pendingAction?.id, prepared.pendingAction?.id);
    const confirm = { requestId: randomUUID(), confirmation: { actionId: prepared.pendingAction!.id, decision: "CONFIRM" as const } };
    await assert.rejects(runtime(first, ledger).send(user, id, confirm));
    await first.close();
    const canonical = await second.get(id, user.id);
    assert.equal(canonical.pendingAction?.status, "WAITING_CONFIRMATION");
    assert.equal(canonical.activeRequest?.requestId, confirm.requestId);
    const resumed = await runtime(second).send(user, id, confirm);
    assert.equal(resumed.state, "COMPLETED");
    assert.equal(resumed.pendingAction, null);
    assert.equal(resumed.activeRequest, null);
    const replay = await runtime(second).send(user, id, confirm);
    assert.deepEqual(replay, resumed);
    assert.equal(fixtureExecutions, 1); assert.equal(modelCalls, 1);
    await assert.rejects(second.get(id, "e".repeat(24)));
    return { engine: "langgraph-customer", checkpointCanonical: true, recoveredAfterLedgerCommit: true,
      recoveredWithNewClient: true, replayNoWork: true, wrongOwnerBlocked: true,
      fixtureExecutions, modelCalls, businessWrites: 0, deletedDocuments: 0 };
  } finally { await first.close(); await second.close(); }
}

if (require.main === module) {
  void (async () => {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("Cần cấp MONGO_URI cho tiến trình; chương trình không tự đọc .env.");
    console.log(JSON.stringify(await verifyAgentCustomerGraphAtlas(uri)));
  })().catch((error: unknown) => {
    console.error("Kiểm chứng engine nghiệp vụ Atlas chưa đạt.", { type: error instanceof Error ? error.name : "unknown" });
    process.exitCode = 1;
  });
}
