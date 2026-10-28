import assert from "node:assert/strict";
import { MemorySaver } from "@langchain/langgraph";
import { z } from "zod";
import { ReadOnlyAgentRuntime, InProcessGraphPilotAccess } from "../ai/runtime/agent-runtime";
import type { ReadOnlyGraphData } from "../ai/runtime/graph-state";
import { ToolRegistry } from "../ai/tools/tool-registry";
import { ProviderHttpError } from "../ai/llm/providers/provider-http";
import type { LLMProvider, LLMRequest } from "../ai/llm/llm.interface";

async function run() {
  require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {}, payoutPayos: {} } } as NodeModule;
  const { sessionView } = await import("../ai/agent/agent.service");
  const user = { id: "khach-phuc-hoi-model", role: "CUSTOMER" as const };
  const input = { requestId: "request-model", message: "Tra cứu hướng dẫn" };
  const final = { type: "FINAL" as const, message: "Đã kiểm tra nguồn mới." };
  const timeout = () => new DOMException("Timeout fixture không chứa dữ liệu khách.", "TimeoutError");
  const access = new InProcessGraphPilotAccess();
  const saver = new MemorySaver();
  let calls = 0;
  const first = new ReadOnlyAgentRuntime({ registry: new ToolRegistry(), checkpointer: saver, provider: { async generate() {
    calls++; throw timeout();
  } } }, access);
  const paused = await first.send(user, "phien-timeout", input);
  assert.equal(paused.state, "FAILED");
  assert.equal(paused.receipts.length, 0);
  assert.equal(paused.activeRequest?.requestId, input.requestId);
  assert.equal(sessionView(paused).interruptedRequest?.requestId, input.requestId);
  assert.equal(paused.conversation.filter((message) => message.role === "user").length, 1);
  assert.ok(paused.conversation[paused.conversation.length - 1].content.includes("Thử lại"));
  await assert.rejects(first.send(user, "phien-timeout", { ...input, message: "Dữ liệu khác" }));
  await assert.rejects(first.send(user, "phien-timeout", { ...input, requestId: "request-khac" }));
  await assert.rejects(first.send({ ...user, id: "khach-khac" }, "phien-timeout", input));
  assert.equal(calls, 1);
  const rebuilt = new ReadOnlyAgentRuntime({ registry: new ToolRegistry(), checkpointer: saver, provider: { async generate() { calls++; return final; } } }, access);
  const completed = await rebuilt.send(user, "phien-timeout", input);
  assert.equal(completed.state, "COMPLETED");
  assert.equal(completed.activeRequest, null);
  assert.equal(completed.receipts.length, 1);
  assert.equal(completed.conversation.filter((message) => message.role === "user").length, 1);
  await rebuilt.send(user, "phien-timeout", input);
  assert.equal(calls, 2, "Chỉ receipt hoàn tất mới chặn thực hiện lại model.");

  // Timeout sau tool vẫn giữ kết quả, nhưng phải đọc lại nguồn khi người dùng tiếp tục.
  let reads = 0;
  let stage = 0;
  const registry = new ToolRegistry().register({ name: "search_customer_knowledge", description: "Nguồn phục hồi fixture.",
    roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false, inputSchema: z.object({}).strict(),
    async execute() { reads++; return { articles: reads === 1 ? [{ title: "Nguồn cũ", content: "đã thu hồi" }] : [{ title: "Nguồn mới", content: "còn hiệu lực" }] }; } });
  const sourceSaver = new MemorySaver();
  const sourceAccess = new InProcessGraphPilotAccess();
  const sourceProvider: LLMProvider = { async generate() {
    if (stage++ === 0) return { type: "TOOL_CALL", tool: "search_customer_knowledge", arguments: {} };
    throw timeout();
  } };
  const source = new ReadOnlyAgentRuntime({ registry, checkpointer: sourceSaver, provider: sourceProvider }, sourceAccess);
  const afterRead = await source.send(user, "phien-nguon", input);
  assert.equal(afterRead.activeRequest?.requestId, input.requestId);
  assert.equal(reads, 1);
  const sourceResume = new ReadOnlyAgentRuntime({ registry, checkpointer: sourceSaver, provider: { async generate(request: LLMRequest) {
    assert.ok(JSON.stringify(request.conversation).includes("Nguồn mới"));
    assert.ok(!JSON.stringify(request.conversation).includes("Nguồn cũ"));
    return final;
  } } }, sourceAccess);
  const refreshed = await sourceResume.send(user, "phien-nguon", input);
  assert.equal(refreshed.state, "COMPLETED");
  assert.equal(reads, 2);
  assert.equal(refreshed.conversation.filter((message) => message.role === "user").length, 1);

  // Lỗi tạm thời không tự retry vô hạn; 429 chờ người dùng, 404 kết thúc rõ ràng.
  for (const status of [503, 429, 404]) {
    let attempts = 0;
    const failed = new ReadOnlyAgentRuntime({ registry: new ToolRegistry(), checkpointer: new MemorySaver(), provider: { async generate() {
      attempts++; throw new ProviderHttpError(status);
    } } }, new InProcessGraphPilotAccess());
    const response = await failed.send(user, `phien-http-${status}`, input);
    assert.equal(attempts, status === 503 ? 2 : 1);
    assert.equal(Boolean(response.activeRequest), status !== 404);
    assert.equal(response.receipts.length, status === 404 ? 1 : 0);
  }
  let boundedCalls = 0;
  const bounded = new ReadOnlyAgentRuntime({ registry: new ToolRegistry(), checkpointer: new MemorySaver(), maxIterations: 2,
    provider: { async generate() { boundedCalls++; throw timeout(); } } }, new InProcessGraphPilotAccess());
  await bounded.send(user, "phien-gioi-han", input);
  await bounded.send(user, "phien-gioi-han", input);
  const ended = await bounded.send(user, "phien-gioi-han", input);
  assert.equal(boundedCalls, 2);
  assert.equal(ended.activeRequest, null);
  assert.equal(ended.receipts.length, 1);

  // Ghi checkpoint lỗi có thể xảy ra trước khi node interrupt kịp chạy.
  class CrashSaver extends MemorySaver {
    armed = true;
    override async put(...args: Parameters<MemorySaver["put"]>) {
      const result = await super.put(...args);
      const data = args[1].channel_values.data as ReadOnlyGraphData | undefined;
      if (this.armed && data?.turn.waitingForModelRetry) { this.armed = false; throw new Error("Crash fixture sau checkpoint model."); }
      return result;
    }
  }
  const crashSaver = new CrashSaver();
  const crashAccess = new InProcessGraphPilotAccess();
  const crashing = new ReadOnlyAgentRuntime({ registry: new ToolRegistry(), checkpointer: crashSaver, provider: { async generate() { throw timeout(); } } }, crashAccess);
  await assert.rejects(crashing.send(user, "phien-crash-model", input));
  const crashResume = new ReadOnlyAgentRuntime({ registry: new ToolRegistry(), checkpointer: crashSaver,
    provider: { async generate() { return final; } } }, crashAccess);
  const crashResult = await crashResume.send(user, "phien-crash-model", input);
  assert.equal(crashResult.state, "COMPLETED");
  assert.equal(crashResult.conversation.filter((message) => message.role === "user").length, 1);
  console.log("Đạt phục hồi model: timeout/503/429 giữ checkpoint, ownership/request, resume sau dựng lại graph, nguồn mới, receipt chống lặp, giới hạn thử và crash trước interrupt.");
}
void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
