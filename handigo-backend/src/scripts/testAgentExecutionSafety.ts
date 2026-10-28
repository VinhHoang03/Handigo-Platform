import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import { AgentLoop } from "../ai/agent/agent-loop.service";
import { newSession } from "../ai/agent/agent-state";
import { ToolRegistry } from "../ai/tools/tool-registry";
import { ToolExecutor } from "../ai/tools/tool-executor";
import { createPaymentTool } from "../ai/tools/implementations/payment.tools";
import { AgentPaymentService } from "../services/agentPayment.service";
import { AGENT_REQUEST_TIMEOUT_MS, AGENT_SESSION_LEASE_MS } from "../ai/agent/runtime-limits";

async function run() {
  const user = { id: "111111111111111111111111", role: "CUSTOMER" as const };
  const args = { orderId: "222222222222222222222222", method: "WALLET" as const };
  const session = newSession(randomUUID(), user.id);
  const context = { user, session, sessionId: session.id, signal: AbortSignal.timeout(10000) };
  const policies = { create_payment: { enabled: true } };
  const registry = new ToolRegistry(policies).register(createPaymentTool);
  const executor = new ToolExecutor(registry);
  let writes = 0, checkpoints = 0;
  mock.method(AgentPaymentService, "preview", async () => ({ amount: 150000, paymentMethod: "wallet", paymentType: "full",
    previousPaymentId: "333333333333333333333333", previousPaymentMethod: "payos" }) as never);
  mock.method(AgentPaymentService, "pay", async () => { writes++; return { orderId: args.orderId, orderCode: "HD-AN-TOAN",
    status: "paid", message: "Đã thanh toán." }; });
  try {
    require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {}, payoutPayos: {} } } as NodeModule;
    const { AgentService } = await import("../ai/agent/agent.service");
    const { registerTools } = await import("../ai/tools/register-tools");
    const productionRegistry = registerTools({});
    const inventory = productionRegistry.list(context);
    assert.equal(inventory.length, 42, "Giữ đủ công cụ nghiệp vụ khi chuẩn bị chuyển runtime.");
    assert(AGENT_SESSION_LEASE_MS > AGENT_REQUEST_TIMEOUT_MS);
    for (const item of inventory) {
      const tool = productionRegistry.get(item.name, context);
      assert.throws(() => productionRegistry.get(item.name, { ...context, user: { ...user, role: "PROVIDER" } }));
      if (tool.mutates) {
        assert(tool.preview);
        assert(tool.reconcile || ["create_payment", "cancel_payment"].includes(tool.name),
          `${tool.name} cần đối soát riêng hoặc luồng thanh toán chuyên biệt.`);
        assert.throws(() => productionRegistry.get(item.name, { ...context, readOnly: true }));
      }
    }
    const loop = new AgentLoop({ generate: async () => ({ type: "TOOL_CALL", tool: "create_payment", arguments: args }) }, registry,
      { maxIterations: 1, timeoutMs: 2000, systemPrompt: "Kiểm thử an toàn" });
    const agent = new AgentService({ acquire: async () => ({ session, lockId: "khoa" }),
      save: async () => { checkpoints++; }, release: async () => {} }, loop);
    await agent.send(user, session.id, { requestId: randomUUID(), message: "Hệ thống có những phương thức thanh toán nào?" });
    assert.equal(writes, 0, "Model chọn nhầm tool không được trừ ví dù có giao dịch trước đó.");
    assert.equal(session.state, "WAITING_CONFIRMATION");
    const action = session.pendingAction!;
    assert.throws(() => executor.authorize(session, context, createPaymentTool, args, action), /Chưa có xác nhận/);
    assert.throws(() => executor.authorize(session, context, createPaymentTool, args), /bản xác nhận/);
    const confirm = { requestId: randomUUID(), confirmation: { actionId: action.id, decision: "CONFIRM" as const } };
    session.activeRequest = { requestId: confirm.requestId, digest: "kiem-thu", input: confirm };
    assert.throws(() => executor.authorize(session, { ...context, user: { ...user, id: "khach-khac" } }, createPaymentTool, args, action), /không thuộc/);
    assert.throws(() => executor.authorize(session, { ...context, readOnly: true }, createPaymentTool, args, action), /đối soát/);
    session.requiresReconciliation = true;
    assert.throws(() => executor.authorize(session, context, createPaymentTool, args, action), /đối soát/);
    session.requiresReconciliation = false;
    assert.throws(() => executor.authorize(session, context, createPaymentTool, { ...args, method: "CASH" }, action), /đúng thông tin/);
    action.expiresAt = "ngay-khong-hop-le";
    assert.throws(() => executor.authorize(session, context, createPaymentTool, args, action));
    action.expiresAt = new Date(Date.now() + 60000).toISOString();
    action.taskVersion++;
    assert.throws(() => executor.authorize(session, context, createPaymentTool, args, action));
    action.taskVersion--;
    policies.create_payment.enabled = false;
    assert.throws(() => executor.authorize(session, context, createPaymentTool, args, action), /không có quyền/);
    policies.create_payment.enabled = true;
    action.status = "EXECUTING";
    assert.throws(() => executor.authorize(session, context, createPaymentTool, args, action));
    action.status = "WAITING_CONFIRMATION";
    session.activeRequest = null;
    await agent.send(user, session.id, confirm);
    assert.equal(writes, 1);
    assert(checkpoints > 0);
    await agent.send(user, session.id, confirm);
    assert.equal(writes, 1, "Request xác nhận lặp không ghi lần hai.");
    console.log("Đạt kiểm soát thực thi: tool gọi nhầm, quyền, đối soát, tham số, phiên bản, hết hạn và request lặp.");
  } finally { mock.restoreAll(); }
}
void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
