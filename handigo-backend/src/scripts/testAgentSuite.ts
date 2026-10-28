import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

// Chỉ chạy bản build và bộ giả lập; đánh giá model thật có lệnh riêng.
async function run() {
  if (!__filename.endsWith(".js")) throw new Error("Hãy chạy npm run test:agent để build trước khi kiểm thử.");
  const tests = ["CustomerReadiness", "ModelUsage", "Context", "TurnRouting", "ReadRefresh", "CustomerModelRecovery", "CustomerMetrics", "ModelWorkflow", "CustomerWorkflow", "CustomerWorkflowHttp", "CustomerActionMatrix", "ActionGraphs", "AddressResolution", "AuditFixes", "BookingExtras", "BookingHistory", "BookingP1", "BookingRecovery",
    "BookingSearchActions", "BookingTracking", "BookingVoucher", "CashPaymentSwitch", "DraftAddress", "EmbeddedPayment",
    "ExecutionSafety", "FlowExtensions", "Facade", "FacadeHttp", "GraphCompatibility", "GraphPersistence", "ReadOnlyGraph", "ModelRecovery", "KnowledgeConversation", "KnowledgePipeline", "KnowledgeRetrieval", "OrderProgress", "OrderProvider", "PaymentCancellation", "WalletRefund",
    "PaymentSwitch", "PaymentSwitchFlow", "PreviousProviders", "Reconciliation", "RepairOptions", "VoucherPricing", "VoucherRequests", "VoucherRuntime"]
    .map((name) => `testAgent${name}.js`);
  let failed = 0;
  for (const file of tests) {
    const path = join(__dirname, file);
    if (!existsSync(path)) throw new Error("Thiếu bài kiểm thử đã build.");
    const passed = await new Promise<boolean>((resolve) => {
      const child = spawn(process.execPath, [path], { stdio: "inherit", timeout: 30000,
        env: { ...process.env, AI_KNOWLEDGE_ENABLED: "false" } });
      child.once("error", () => resolve(false));
      child.once("close", (code) => resolve(code === 0));
    });
    console.log(`${passed ? "ĐẠT" : "LỖI"}: ${file}`);
    if (!passed) failed++;
  }
  console.log(`Kết quả agent: ${tests.length - failed}/${tests.length} bài đạt; ${failed} bài lỗi.`);
  if (failed) process.exitCode = 1;
}
void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
