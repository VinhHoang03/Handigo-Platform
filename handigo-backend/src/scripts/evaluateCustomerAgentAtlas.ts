import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import mongoose from "mongoose";
import { z } from "zod";
import { ragConversationCases, assessRagConversation } from "../ai/knowledge/evaluation/conversation-cases";
import { createCustomerGraphConnection } from "../ai/runtime/customer-graph-connection";
import { loadAgentConfig } from "../ai/ai.config";
import { observeCustomerTurn, type CustomerTurnMetric } from "../ai/runtime/customer-runtime-metrics";
import type { AgentSession } from "../ai/agent/agent-state";

// Chỉ dùng chủ sở hữu fixture và các tool tra cứu công khai. Không tạo user/đơn/thanh toán/hồ sơ thật.
export async function evaluateCustomerAgentAtlas() {
  if (!process.env.MONGO_URI) throw new Error("Cần cấp cấu hình cho tiến trình.");
  require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {}, payoutPayos: {} } } as NodeModule;
  const { CustomerWorkflowRuntime } = await import("../ai/runtime/customer-workflow-runtime");
  const { ToolRegistry } = await import("../ai/tools/tool-registry");
  const { searchCustomerKnowledgeTool } = await import("../ai/tools/implementations/search-customer-knowledge.tool");
  const { getSystemInfoTool } = await import("../ai/tools/implementations/get-system-info.tool");
  const config = loadAgentConfig(), provider = config.createProvider();
  const connection = createCustomerGraphConnection(process.env.MONGO_URI);
  const user = { id: randomUUID().replace(/-/g, "").slice(0, 24), role: "CUSTOMER" as const };
  const results: Array<Record<string, unknown>> = [];
  try {
    await mongoose.connect(process.env.MONGO_URI, { autoCreate: false, autoIndex: false, serverSelectionTimeoutMS: 12000 });
    await connection.open();
    for (const test of ragConversationCases) {
      let modelCalls = 0, retrievalCalls = 0;
      let articles: Array<{ title: string; source: string }> = [];
      const events: CustomerTurnMetric[] = [];
      const registry = new ToolRegistry({}, true).register({ ...searchCustomerKnowledgeTool,
        execute: async (context, args) => {
          retrievalCalls++;
          const result = await searchCustomerKnowledgeTool.execute(context, args);
          articles = z.object({ articles: z.array(z.object({ title: z.string(), source: z.string() })) }).parse(result).articles;
          return result;
        } }).register(getSystemInfoTool);
      const runtime = () => new CustomerWorkflowRuntime({ config, registry, checkpointer: connection.saver,
        ledger: connection.ledger, access: connection.access, assertWriteAccess: connection.assertWriteAccess,
        mergeMessages: async (session: AgentSession) => session,
        provider: { generate: async (request) => { modelCalls++; return provider.generate(request); } } });
      const id = randomUUID(), input = { requestId: randomUUID(), message: test.query };
      const started = Date.now();
      let session = await observeCustomerTurn(() => runtime().send(user, id, input), (event) => events.push(event));
      const firstAttemptAnswered = !session.activeRequest && ["COMPLETED", "WAITING_USER_INPUT"].includes(session.state);
      let manualResumes = 0;
      while (session.activeRequest && manualResumes < 2) {
        manualResumes++;
        session = await observeCustomerTurn(() => runtime().send(user, id, input), (event) => events.push(event));
      }
      const answer = session.conversation.filter((message) => message.role === "assistant").slice(-1)[0]?.content ?? "";
      const checks: Record<string, boolean> = assessRagConversation(test, { state: session.state, answer, articles });
      checks.requestCompleted = !session.activeRequest;
      checks.noBusinessAction = !session.pendingAction && !session.actions.length;
      if (!session.activeRequest) {
        const before = { modelCalls, retrievalCalls };
        await runtime().send(user, id, input);
        checks.replayNoWork = before.modelCalls === modelCalls && before.retrievalCalls === retrievalCalls;
      }
      const item = { id: test.id, checks, passed: Object.values(checks).every(Boolean), elapsedMs: Date.now() - started,
        modelCalls, retrievalCalls, firstAttemptAnswered, manualResumes, answer, sources: articles.map((article) => article.title), events };
      results.push(item);
      console.log(JSON.stringify({ id: test.id, passed: item.passed, elapsedMs: item.elapsedMs, firstAttemptAnswered, manualResumes, checks }));
    }
    const folder = join(process.cwd(), "docs", "evaluations"); await mkdir(folder, { recursive: true });
    const filename = `customer-agent-atlas-${Date.now()}.json`;
    const report = { createdAt: new Date().toISOString(), engine: "langgraph-customer", cases: results.length,
      passed: results.filter((item) => item.passed).length, results, businessWrites: 0, deletedDocuments: 0,
      limitations: "Gemini/Atlas thật, chủ sở hữu và yêu cầu fixture; chưa phải tài khoản đăng nhập thật hoặc E2E giao diện. Không thay kiểm tra tải." };
    await writeFile(join(folder, filename), JSON.stringify(report, null, 2), { flag: "wx" });
    return { passed: report.passed, cases: report.cases, report: `docs/evaluations/${filename}` };
  } finally { await connection.close(); await mongoose.disconnect(); }
}

if (require.main === module) void evaluateCustomerAgentAtlas().then((result) => {
  console.log(JSON.stringify(result)); if (result.passed !== result.cases) process.exitCode = 1;
}).catch((error: unknown) => { console.error(JSON.stringify({ completed: false, type: error instanceof Error ? error.name : "unknown" })); process.exitCode = 1; });
