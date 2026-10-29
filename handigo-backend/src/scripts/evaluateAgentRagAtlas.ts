import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import mongoose from "mongoose";
import { z } from "zod";
import { ProviderHttpError } from "../ai/llm/providers/provider-http";
import type { LLMProvider } from "../ai/llm/llm.interface";
import { searchCustomerKnowledgeTool } from "../ai/tools/implementations/search-customer-knowledge.tool";
import { getSystemInfoTool } from "../ai/tools/implementations/get-system-info.tool";
import { ToolRegistry } from "../ai/tools/tool-registry";
import { createPersistentGraphConnection } from "../ai/runtime/mongo-graph-access";
import { ReadOnlyAgentRuntime } from "../ai/runtime/agent-runtime";
import { loadKnowledgeConfig } from "../ai/knowledge/knowledge.config";
import { ragConversationCases, assessRagConversation } from "../ai/knowledge/evaluation/conversation-cases";
import { AppError } from "../utils/appError";
import { loadAgentConfig } from "../ai/ai.config";

const articlesSchema = z.object({ articles: z.array(z.object({ title: z.string(), source: z.string() })) });
type CaseReport = { id: string; engine: string; elapsedMs: number; modelCalls: number; retrievalCalls: number;
  manualResumes: number; firstAttemptAnswered?: boolean;
  checks: Record<string, boolean>; passed: boolean; answer: string; sources: string[]; diagnostics: string[] };

async function saveReport(prefix: string, report: unknown) {
  const folder = join(process.cwd(), "docs", "evaluations");
  await mkdir(folder, { recursive: true });
  const filename = `${prefix}-${Date.now()}.json`;
  await writeFile(join(folder, filename), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  return `docs/evaluations/${filename}`;
}

// Chỉ nhận key/URI từ tiến trình được cấp quyền; không tải .env, không dùng tool nghiệp vụ, không xóa fixture.
export async function evaluateAgentRagAtlas(uri: string, apiKey: string, onCase?: (result: CaseReport) => void) {
  assert.ok(apiKey);
  require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {}, payoutPayos: {} } } as NodeModule;
  const { AgentFacade } = await import("../ai/runtime/agent-facade");
  const { SessionService } = await import("../ai/session/session.service");
  const { AgentService } = await import("../ai/agent/agent.service");
  const { AgentLoop } = await import("../ai/agent/agent-loop.service");
  const { AGENT_PROMPT } = await import("../ai/agent/agent-prompt");
  const previousKey = process.env.GEMINI_API_KEY;
  const previousRag = process.env.AI_KNOWLEDGE_ENABLED;
  process.env.GEMINI_API_KEY = apiKey;
  process.env.AI_KNOWLEDGE_ENABLED = "true";
  const storage = createPersistentGraphConnection(uri);
  const results: CaseReport[] = [];
  const engines: Array<"langgraph-readonly" | "legacy"> = process.env.AI_AGENT_EVAL_GRAPH_ONLY === "true"
    ? ["langgraph-readonly"] : ["langgraph-readonly", "legacy"];
  try {
    const owner = randomUUID().replace(/-/g, "").slice(0, 24);
    const user = { id: owner, role: "CUSTOMER" as const };
    const config = loadKnowledgeConfig();
    // Dùng cùng cấu hình/provider với agent đang triển khai; override đánh giá phải được đặt rõ.
    const agent = loadAgentConfig({ ...process.env, GEMINI_API_KEY: apiKey,
      AI_AGENT_MODEL: process.env.AI_AGENT_EVAL_MODEL || process.env.AI_AGENT_MODEL });
    if (agent.provider !== "gemini") throw new AppError("Bộ đánh giá này cần cấu hình AI_AGENT_PROVIDER=gemini.", 400);
    const model = agent.model;
    const base = agent.createProvider();
    // Xác minh model trước khi tạo phiên đánh giá; không tự đổi model khi lỗi hoặc hết quota.
    const preflight: Array<{ type: string; status?: number; reason?: string }> = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await base.generate({ system: "Trả FINAL với message Sẵn sàng. Không gọi công cụ nghiệp vụ.", goal: "Kiểm tra kết nối model.",
          conversation: [], tools: [], signal: AbortSignal.timeout(agent.timeoutMs) });
        break;
      } catch (error) {
        preflight.push({ type: error instanceof Error ? error.name : "unknown",
          ...(error instanceof ProviderHttpError ? { status: error.status, reason: error.diagnostic?.reason } : {}) });
        const temporary = error instanceof ProviderHttpError ? [502, 503, 504].includes(error.status)
          : error instanceof Error && error.name === "TimeoutError";
        if (attempt === 2 || !temporary) {
          const report = await saveReport("agent-rag-preflight", { createdAt: new Date().toISOString(), model,
            status: "blocked", plannedCases: ragConversationCases.length * engines.length + 2, engines, casesRun: 0, diagnostics: preflight,
            note: "Chưa chạy hội thoại: model chưa vượt kiểm tra kết nối trong giới hạn thời gian. Không tính thành độ đúng retrieval hoặc câu trả lời." });
          return { status: "blocked" as const, report, passed: 0, cases: 0 };
        }
        await delay(1000 * (attempt + 1));
      }
    }
    await mongoose.connect(uri, { autoCreate: false, autoIndex: false, serverSelectionTimeoutMS: 12000 });
    await storage.open();
    let modelCalls = 0;
    let retrievalCalls = 0;
    let outage = false;
    let abortAfterRead: AbortController | undefined;
    let articles: Array<{ title: string; source: string }> = [];
    let diagnostics: string[] = [];
    const provider: LLMProvider = { async generate(request) {
      modelCalls++;
      if (abortAfterRead && retrievalCalls > 0) {
        abortAfterRead.abort();
        throw new Error("Ngắt có kiểm soát sau khi tool đã lưu checkpoint.");
      }
      try { return await base.generate(request); }
      catch (error) {
        diagnostics.push(error instanceof ProviderHttpError ? `HTTP_${error.status}:${error.diagnostic?.reason ?? "UNKNOWN"}`
          : error instanceof Error ? error.name : "unknown");
        throw error;
      }
    } };
    const registry = new ToolRegistry().register({ ...searchCustomerKnowledgeTool, execute: async (context, args) => {
      retrievalCalls++;
      if (outage) throw new AppError("Nguồn kiểm thử tạm thời lỗi.", 503);
      const result = await searchCustomerKnowledgeTool.execute(context, args);
      articles.push(...articlesSchema.parse(result).articles);
      return result;
    } }).register(getSystemInfoTool);
    const sessions = new SessionService();
    const runtime = () => new ReadOnlyAgentRuntime({ provider, registry, checkpointer: storage.saver,
      maxIterations: 6 }, storage.access);
    let signal: AbortSignal | undefined;
    let selected: "legacy" | "langgraph-readonly" = "langgraph-readonly";
    const facade = new AgentFacade(sessions, async () => ({ get: storage.get,
      exclusive: (customer, id, action) => storage.access.exclusive(customer, id, () => action()),
      send: (customer, id, input) => runtime().send(customer, id, input, signal),
    }), (customer, id, input) => new AgentService(sessions,
      new AgentLoop(provider, registry, { systemPrompt: AGENT_PROMPT, maxIterations: 6, timeoutMs: 20000 })).send(customer, id, input), () => selected);

    for (const engine of engines) {
      selected = engine;
      for (const test of ragConversationCases) {
        modelCalls = 0; retrievalCalls = 0; articles = []; diagnostics = [];
        const id = randomUUID();
        const input = { requestId: randomUUID(), message: test.query };
        const start = Date.now();
        let view = await facade.send(user, id, input);
        const firstAttemptAnswered = !view.interruptedRequest && ["COMPLETED", "WAITING_USER_INPUT"].includes(view.state);
        let manualResumes = 0;
        // Mô phỏng một lần khách bấm Tiếp tục, không phải retry tự động bên trong runtime.
        if (view.interruptedRequest) { manualResumes++; view = await facade.send(user, id, input); }
        const answer = view.messages.filter((message) => message.sender === "assistant").map((message) => message.content).join("\n");
        const checks: Record<string, boolean> = assessRagConversation(test, { state: view.state, answer, articles });
        if (!view.interruptedRequest) {
          const beforeReplay = { modelCalls, retrievalCalls };
          await facade.send(user, id, input);
          checks.replayNoWork = modelCalls === beforeReplay.modelCalls && retrievalCalls === beforeReplay.retrievalCalls;
        } else checks.requestCompleted = false;
        const result: CaseReport = { id: test.id, engine, checks, passed: Object.values(checks).every(Boolean),
          elapsedMs: Date.now() - start, modelCalls, retrievalCalls, manualResumes, firstAttemptAnswered, answer,
          sources: [...new Set(articles.map((article) => article.title))], diagnostics };
        results.push(result); onCase?.(result);
      }
    }
    selected = "langgraph-readonly";
    outage = true; modelCalls = 0; retrievalCalls = 0; articles = []; diagnostics = [];
    let start = Date.now();
    const failed = await facade.send(user, randomUUID(), { requestId: randomUUID(), message: ragConversationCases[0].query });
    let checks: Record<string, boolean> = { failed: failed.state === "FAILED", sourceAttempted: retrievalCalls > 0, noStaticFallback: articles.length === 0 };
    let result: CaseReport = { id: "source-outage", engine: selected, elapsedMs: Date.now() - start, modelCalls, retrievalCalls, manualResumes: 0,
      checks, passed: Object.values(checks).every(Boolean), answer: failed.messages[failed.messages.length - 1]?.content ?? "", sources: [], diagnostics };
    results.push(result); onCase?.(result);
    outage = false;

    modelCalls = 0; retrievalCalls = 0; articles = []; diagnostics = [];
    const id = randomUUID();
    const input = { requestId: randomUUID(), message: ragConversationCases[0].query };
    abortAfterRead = new AbortController(); signal = abortAfterRead.signal;
    start = Date.now();
    let interrupted = false;
    try { await facade.send(user, id, input); } catch { interrupted = true; }
    const before = await facade.get(user, id);
    signal = undefined; abortAfterRead = undefined;
    let resumed = await facade.send(user, id, input);
    let manualResumes = 0;
    if (resumed.interruptedRequest) { manualResumes++; resumed = await facade.send(user, id, input); }
    checks = { interrupted, checkpointRunning: Boolean(before.activeRequest), resumed: resumed.state === "COMPLETED",
      oneUserMessage: resumed.messages.filter((message) => message.sender === "user").length === 1,
      refreshedSource: retrievalCalls >= 2 };
    result = { id: "resume-real-rag", engine: selected, elapsedMs: Date.now() - start, modelCalls, retrievalCalls, manualResumes,
      checks, passed: Object.values(checks).every(Boolean), answer: resumed.messages[resumed.messages.length - 1]?.content ?? "",
      sources: [...new Set(articles.map((article) => article.title))], diagnostics };
    results.push(result); onCase?.(result);
    const report = { createdAt: new Date().toISOString(), model, engines, graphVersion: "customer-readonly-v1",
      generation: config.generation, minVectorScore: config.minVectorScore, cases: results.length,
      passed: results.filter((item) => item.passed).length, results,
      firstAttemptAnswered: results.filter((item) => item.firstAttemptAnswered === true).length,
      casesWithManualResume: results.filter((item) => item.manualResumes > 0).length,
      limitations: "Bộ nhỏ, chạy tuần tự, tối đa một lần mô phỏng bấm Tiếp tục khi tạm dừng. Báo cáo giữ lỗi/thời gian/lần đầu; không thay đánh giá ngữ nghĩa, E2E xác thực thật hoặc đo tải." };
    return { status: "completed" as const, report: await saveReport("agent-rag", report), passed: report.passed, cases: report.cases };
  } finally {
    await storage.close(); await mongoose.disconnect();
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousKey;
    if (previousRag === undefined) delete process.env.AI_KNOWLEDGE_ENABLED; else process.env.AI_KNOWLEDGE_ENABLED = previousRag;
  }
}

if (require.main === module) {
  void (async () => {
    if (!process.env.MONGO_URI || !process.env.GEMINI_API_KEY) throw new Error("Cần cấp MONGO_URI/GEMINI_API_KEY cho tiến trình; không tự đọc .env.");
    const result = await evaluateAgentRagAtlas(process.env.MONGO_URI, process.env.GEMINI_API_KEY,
      (item) => console.log(JSON.stringify({ id: item.id, engine: item.engine, passed: item.passed, elapsedMs: item.elapsedMs, checks: item.checks })));
    console.log(JSON.stringify(result));
    if (result.status !== "completed" || result.passed !== result.cases) process.exitCode = 1;
  })().catch((error: unknown) => { console.error("Đánh giá hội thoại thật chưa hoàn tất.", { type: error instanceof Error ? error.name : "unknown" }); process.exitCode = 1; });
}
