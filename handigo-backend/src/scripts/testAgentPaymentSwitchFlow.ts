import assert from "node:assert/strict";
import { mock } from "node:test";
import { AgentLoop } from "../ai/agent/agent-loop.service";
import { newSession } from "../ai/agent/agent-state";
import { ToolRegistry } from "../ai/tools/tool-registry";
import { createPaymentTool } from "../ai/tools/implementations/payment.tools";
import { AgentPaymentService } from "../services/agentPayment.service";
import { AppError } from "../utils/appError";
import { ActionPreconditionError } from "../utils/actionPreconditionError";

// Cô lập thanh toán; kiểm tra luồng thật mà không gọi ví, PayOS hoặc database.
async function run() {
  const user = { id: "111111111111111111111111", role: "CUSTOMER" as const };
  const orderId = "222222222222222222222222";
  const previousPaymentId = "333333333333333333333333";
  for (const [previousPaymentMethod, method] of [["payos", "WALLET"], ["payos", "CASH"], ["cash", "WALLET"], ["cash", "PAYOS"]] as const) {
    for (const mode of ["ok", "new", "blocked", "changed", "unknown", "readOnly"] as const) {
      const session = newSession(`doi-${previousPaymentMethod}-${method}-${mode}`, user.id);
      session.conversation.push({ id: "yeu-cau", role: "user", content: `Đổi thanh toán đơn này sang ${method}`, createdAt: new Date().toISOString() });
      const preview = { amount: 150000, paymentType: "full" as const,
        ...(mode === "new" ? {} : { previousPaymentId, previousPaymentMethod }) };
      let executions = 0;
      let savedIntent = false;
      mock.method(AgentPaymentService, "preview", async () => {
        if (mode === "blocked") throw new AppError("Ví không đủ hoặc chưa thể đổi thanh toán.", 400);
        return preview;
      });
      mock.method(AgentPaymentService, "pay", async (...[_user, args, expected]: Parameters<typeof AgentPaymentService.pay>) => {
        executions++;
        assert(savedIntent, "Phải lưu ý định trước khi thực hiện thanh toán");
        assert.equal(args.method, method);
        assert.deepEqual(expected, preview);
        if (mode === "unknown") throw new Error("Mất kết nối sau khi ghi");
        if (mode === "changed") throw new ActionPreconditionError();
        return { orderId, orderCode: "ORD-DOI", status: method === "WALLET" ? "paid" : method === "CASH" ? "cash_pending" : "pending",
          message: "Đã xử lý phương thức mới." };
      });
      const registry = new ToolRegistry().register(createPaymentTool);
      const loop = new AgentLoop({ generate: async () => ({ type: "TOOL_CALL", tool: "create_payment", arguments: { orderId, method } }) }, registry,
        { maxIterations: 1, systemPrompt: "Kiểm thử", timeoutMs: 2000 });
      await loop.run(session, { user, session, sessionId: session.id, signal: AbortSignal.timeout(5000), readOnly: mode === "readOnly" }, async () => {
        if (session.pendingAction?.status === "EXECUTING") savedIntent = true;
      });
      if (mode === "new") {
        assert.equal(session.state, "WAITING_CONFIRMATION", "Thanh toán mới vẫn cần xác nhận");
        assert.equal(executions, 0);
      } else {
        assert.equal(session.pendingAction, null, "Đổi phương thức không để lại form xác nhận");
        assert(!session.conversation.some(item => item.confirmationActionId));
        assert.equal(executions, ["blocked", "readOnly"].includes(mode) ? 0 : 1);
        const action = session.actions[session.actions.length - 1];
        if (mode === "ok") assert.equal(action?.status, "SUCCEEDED");
        if (mode === "unknown") {
          assert.equal(action?.status, "UNKNOWN");
          assert.equal(session.requiresReconciliation, true, "Giữ khóa đối soát khi chưa rõ kết quả");
        }
        if (mode === "changed") assert.equal(action?.status, "EXPIRED");
      }
      mock.restoreAll();
    }
  }
  console.log("Đã kiểm tra 24 trường hợp đổi phương thức: không form, lưu ý định, chặn lỗi, khóa đối soát và giữ xác nhận cho thanh toán mới.");
}
void run().catch(error => { mock.restoreAll(); console.error(error); process.exitCode = 1; });
