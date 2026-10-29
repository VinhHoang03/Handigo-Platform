import assert from "node:assert/strict";
import { MemorySaver } from "@langchain/langgraph";
import { z } from "zod";
import { ReadOnlyAgentRuntime, InProcessGraphPilotAccess } from "../ai/runtime/agent-runtime";
import { READ_ONLY_GRAPH_TOOLS } from "../ai/runtime/graph-router";
import { createGraphCheckpointConnection, GRAPH_CHECKPOINT_COLLECTIONS } from "../ai/runtime/checkpoint";
import { ToolRegistry } from "../ai/tools/tool-registry";
import type { LLMProvider, LLMRequest, LLMResponse } from "../ai/llm/llm.interface";
import type { RequestUser } from "../middlewares/authContext";
import { ProviderHttpError } from "../ai/llm/providers/provider-http";

const customer: RequestUser = { id: "khach-graph-1", role: "CUSTOMER" };
const toolCall = { type: "TOOL_CALL", tool: "search_customer_knowledge", arguments: { query: "hủy QR" } } satisfies LLMResponse;
const final = { type: "FINAL", message: "Theo hướng dẫn thanh toán, bạn có thể hủy QR đang chờ tại chi tiết đơn." } satisfies LLMResponse;
const query = { requestId: "yeu-cau-1", message: "Hủy QR thế nào?" };

function sequence(responses: LLMResponse[], inspect?: (request: LLMRequest) => void): LLMProvider {
  let index = 0;
  return { async generate(request) {
    inspect?.(request);
    const response = responses[index++];
    assert.ok(response, "Không được gọi model vượt fixture.");
    return response;
  } };
}

function fixture(execute = async () => ({ articles: [{ title: "Hướng dẫn thanh toán", content: "Hủy QR đang chờ tại chi tiết đơn." }] })) {
  return new ToolRegistry().register({ name: "search_customer_knowledge", description: "Tra cứu hướng dẫn đã duyệt.",
    roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
    inputSchema: z.object({ query: z.string().min(1) }).strict(), execute });
}

async function run() {
  require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {}, payoutPayos: {} } } as NodeModule;
  const { registerTools } = await import("../ai/tools/register-tools");
  const { sessionView } = await import("../ai/agent/agent.service");
  let reads = 0;
  let models = 0;
  const registry = fixture(async () => { reads++; return { articles: [{ title: "Hướng dẫn thanh toán", content: "Hủy QR đang chờ tại chi tiết đơn." }] }; });
  const saver = new MemorySaver();
  const access = new InProcessGraphPilotAccess();
  const traces: unknown[] = [];
  const runtime = new ReadOnlyAgentRuntime({ registry, checkpointer: saver, provider: sequence([toolCall, final], (request) => {
    models++;
    assert.ok(request.system.includes("không thay đổi bản nháp"));
    assert.deepEqual((request.tools as Array<{ name: string }>).map((tool) => tool.name), ["search_customer_knowledge"]);
  }), onStep: (event) => traces.push(event) }, access);
  const session = await runtime.send(customer, "phien-doc", query);
  assert.equal(session.state, "COMPLETED");
  assert.equal(session.conversation.length, 3);
  const view = sessionView(session);
  assert.equal(view.messages.length, 2);
  assert.equal(view.pendingConfirmation, null);
  assert.equal(view.bookingDraft, null);
  assert.equal(view.interruptedRequest, null);
  assert.equal(view.messages[1].content, final.message);
  assert.equal(traces.length, 4);
  assert.ok(!JSON.stringify(traces).includes(query.message));
  assert.deepEqual(await runtime.send(customer, "phien-doc", query), session);
  assert.equal(reads, 1);
  assert.equal(models, 2);
  // Caller sửa projection không được thay đổi nguồn checkpoint.
  session.conversation[0].content = "Nội dung sửa ngoài graph";
  assert.equal((await runtime.send(customer, "phien-doc", query)).conversation[0].content, query.message);
  await assert.rejects(runtime.send(customer, "phien-doc", { ...query, message: "Nội dung khác" }));
  await assert.rejects(runtime.send({ ...customer, id: "khach-khac" }, "phien-doc", query));
  await assert.rejects(runtime.send({ ...customer, role: "PROVIDER" }, "phien-doc", query));
  await assert.rejects(runtime.send(customer, "phien-doc", { ...query, thread_id: "tuy-y" }));
  await assert.rejects(runtime.send(customer, "phien-doc", { requestId: "xac-nhan", confirmation: { actionId: "a", decision: "CONFIRM" } }));

  // Ghim ownership/version ở checkpoint, kể cả khi host ánh xạ sai thread.
  let capturedThread = "";
  await access.exclusive(customer, "phien-doc", async (thread) => { capturedThread = thread; });
  const wrongAccess = { async exclusive<T>(_user: RequestUser, _session: string, runThread: (thread: string) => Promise<T>) {
    return runThread(capturedThread);
  } };
  const wrongRuntime = new ReadOnlyAgentRuntime({ registry, checkpointer: saver, provider: sequence([]) }, wrongAccess);
  await assert.rejects(wrongRuntime.send({ ...customer, id: "khach-khac" }, "phien-doc", query));

  // Dựng lại runtime: giữ lịch sử và không gọi model/tool khi request đã có receipt.
  const rebuilt = new ReadOnlyAgentRuntime({ registry, checkpointer: saver, provider: sequence([{ type: "MESSAGE", message: "Bạn muốn tra cứu dịch vụ nào?",
    choiceGroups: [{ label: "Dịch vụ", multiple: false, options: ["Vệ sinh điều hòa"] }] }], (request) => {
    assert.ok(request.conversation.some((message) => message.role === "assistant" && message.content === final.message));
    assert.equal(request.conversation.filter((message) => message.role === "tool").length, 0);
  }) }, access);
  const second = await rebuilt.send(customer, "phien-doc", { requestId: "yeu-cau-2", message: "Tư vấn dịch vụ" });
  assert.equal(second.receipts.length, 2);
  assert.equal(second.state, "WAITING_USER_INPUT");
  const secondMessages = sessionView(second).messages;
  assert.equal(secondMessages[secondMessages.length - 1]?.choiceGroups?.length, 1);
  assert.equal(reads, 1);

  // Model cố gọi mọi tool ghi/bản nháp trong registry thật: không được thực thi.
  const realRegistry = registerTools({});
  const ctx = { user: customer, sessionId: "kiem-ke", signal: new AbortController().signal };
  const forbidden = realRegistry.list(ctx).filter((tool) => !((READ_ONLY_GRAPH_TOOLS as readonly string[]).includes(tool.name)));
  assert.ok(forbidden.length > 20);
  for (const tool of forbidden) {
    const blocked = new ReadOnlyAgentRuntime({ registry: realRegistry, checkpointer: new MemorySaver(),
      provider: sequence([{ type: "TOOL_CALL", tool: tool.name, arguments: {} }]) }, new InProcessGraphPilotAccess());
    const result = await blocked.send(customer, `chan-${tool.name}`, query);
    assert.equal(result.state, "WAITING_USER_INPUT", tool.name);
    assert.equal(result.conversation.filter((message) => message.role === "tool").length, 0, tool.name);
  }
  // Tên có trong allowlist vẫn phải qua role/policy/schema của registry và executor.
  for (const deniedRegistry of [new ToolRegistry({ search_customer_knowledge: { enabled: false } }),
    new ToolRegistry({ search_customer_knowledge: { requiresConfirmation: true } }),
    new ToolRegistry({ search_customer_knowledge: { roles: ["ADMIN"] } })]) {
    deniedRegistry.register({ ...registry.get("search_customer_knowledge", ctx) });
    const denied = new ReadOnlyAgentRuntime({ registry: deniedRegistry, checkpointer: new MemorySaver(), provider: sequence([toolCall]) }, new InProcessGraphPilotAccess());
    assert.equal((await denied.send(customer, "chan-policy", query)).state, "FAILED");
  }
  assert.equal(reads, 1);
  const invalid = new ReadOnlyAgentRuntime({ registry, checkpointer: new MemorySaver(),
    provider: sequence([{ ...toolCall, arguments: {} }]) }, new InProcessGraphPilotAccess());
  assert.equal((await invalid.send(customer, "sai-tham-so", query)).state, "FAILED");
  assert.equal(reads, 1);

  // Nguồn lỗi phải dừng, không gọi model tạo câu trả lời thiếu bằng chứng hoặc lộ lỗi thô.
  const failed = new ReadOnlyAgentRuntime({ registry: fixture(async () => { throw new Error("noi-dung-nhay-cam-gia-lap"); }),
    checkpointer: new MemorySaver(), provider: sequence([toolCall]) }, new InProcessGraphPilotAccess());
  const failedSession = await failed.send(customer, "loi-nguon", query);
  assert.equal(failedSession.state, "FAILED");
  assert.ok(!JSON.stringify(failedSession).includes("noi-dung-nhay-cam-gia-lap"));
  const empty = new ReadOnlyAgentRuntime({ registry: fixture(async () => ({ articles: [] })), checkpointer: new MemorySaver(),
    provider: sequence([toolCall, { type: "FINAL", message: "Chưa có nguồn phù hợp. Bạn vui lòng liên hệ hỗ trợ." }]) }, new InProcessGraphPilotAccess());
  assert.equal((await empty.send(customer, "khong-co-nguon", query)).state, "COMPLETED");

  // Gián đoạn sau checkpoint tool: không thêm lại yêu cầu; đọc mới trước khi sinh câu trả lời.
  const recoverySaver = new MemorySaver();
  const recoveryAccess = new InProcessGraphPilotAccess();
  const controller = new AbortController();
  let recoveryReads = 0;
  const recoveryRegistry = fixture(async () => { recoveryReads++; return { articles: recoveryReads === 1
    ? [{ title: "Nguồn sẽ thu hồi", content: "Nội dung cũ" }] : [] }; });
  let call = 0;
  const interrupted = new ReadOnlyAgentRuntime({ registry: recoveryRegistry, checkpointer: recoverySaver, provider: {
    async generate() {
      if (++call === 1) return toolCall;
      controller.abort();
      throw new Error("Ngắt giả lập sau checkpoint tool.");
    },
  } }, recoveryAccess);
  await assert.rejects(interrupted.send(customer, "phuc-hoi", query, controller.signal));
  assert.equal(recoveryReads, 1);
  const resumed = new ReadOnlyAgentRuntime({ registry: recoveryRegistry, checkpointer: recoverySaver, provider: sequence([final], (request) => {
    assert.ok(!JSON.stringify(request.conversation).includes("Nguồn sẽ thu hồi"));
    assert.ok(request.conversation.some((message) => message.role === "tool" && message.content === '{"articles":[]}'));
  }) }, recoveryAccess);
  await assert.rejects(resumed.send(customer, "phuc-hoi", { requestId: "yeu-cau-moi", message: "Yêu cầu khác" }));
  const recovered = await resumed.send(customer, "phuc-hoi", query);
  assert.equal(recovered.state, "COMPLETED");
  assert.equal(recovered.conversation.filter((message) => message.role === "user").length, 1);
  assert.equal(recoveryReads, 2);

  // Hai instance dùng chung cổng pilot phải chặn request đồng thời trước checkpoint/model.
  const concurrentAccess = new InProcessGraphPilotAccess();
  const concurrentSaver = new MemorySaver();
  let release!: () => void;
  let started!: () => void;
  const entered = new Promise<void>((resolve) => { started = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const concurrent = new ReadOnlyAgentRuntime({ registry, checkpointer: concurrentSaver, provider: { async generate() {
    started(); await gate; return final;
  } } }, concurrentAccess);
  const concurrentOther = new ReadOnlyAgentRuntime({ registry, checkpointer: concurrentSaver, provider: sequence([]) }, concurrentAccess);
  const pending = concurrent.send(customer, "dong-thoi", query);
  await entered;
  await assert.rejects(concurrentOther.send(customer, "dong-thoi", query));
  release();
  await pending;
  assert.equal((await concurrentOther.send(customer, "dong-thoi", query)).state, "COMPLETED");

  const bounded = new ReadOnlyAgentRuntime({ registry, checkpointer: new MemorySaver(),
    provider: sequence([toolCall, toolCall]), maxIterations: 2, onStep: () => { throw new Error("Lỗi trace giả lập"); } }, new InProcessGraphPilotAccess());
  assert.equal((await bounded.send(customer, "gioi-han", query)).state, "WAITING_USER_INPUT");

  const tooLarge = new ReadOnlyAgentRuntime({ registry: fixture(async () => ({ articles: [{ title: "Nguồn quá lớn", content: "x".repeat(33000) }] })),
    checkpointer: new MemorySaver(), provider: sequence([toolCall]) }, new InProcessGraphPilotAccess());
  const largeSession = await tooLarge.send(customer, "ket-qua-lon", query);
  assert.equal(largeSession.state, "FAILED");
  assert.equal(largeSession.conversation.length, 2);
  const brokenModel = new ReadOnlyAgentRuntime({ registry, checkpointer: new MemorySaver(), provider: { async generate() {
    throw new Error("loi-model-nhay-cam-gia-lap");
  } } }, new InProcessGraphPilotAccess());
  const brokenSession = await brokenModel.send(customer, "loi-model", query);
  assert.equal(brokenSession.state, "FAILED");
  assert.ok(!JSON.stringify(brokenSession).includes("loi-model-nhay-cam-gia-lap"));

  // Chỉ dựng client/adapter; tuyệt đối không mở mạng hoặc setup collection trong bài offline.
  for (const status of [503, 404, 429]) {
    let attempts = 0;
    const retrying = new ReadOnlyAgentRuntime({ registry, checkpointer: new MemorySaver(), provider: { async generate() {
      attempts++;
      if (attempts === 1) throw new ProviderHttpError(status);
      return final;
    } } }, new InProcessGraphPilotAccess());
    const retried = await retrying.send(customer, `loi-http-${status}`, query);
    assert.equal(attempts, status === 503 ? 2 : 1);
    assert.equal(retried.state, status === 503 ? "COMPLETED" : "FAILED");
  }
  const connection = createGraphCheckpointConnection("mongodb://127.0.0.1:27017/kiem_thu_khong_ket_noi");
  assert.equal(connection.saver.checkpointCollectionName, GRAPH_CHECKPOINT_COLLECTIONS.checkpoints);
  assert.equal(connection.saver.checkpointWritesCollectionName, GRAPH_CHECKPOINT_COLLECTIONS.writes);
  await connection.close();
  console.log("Đạt graph chỉ đọc: contract, policy, toàn bộ tool ngoài allowlist, replay, lịch sử, ownership, phục hồi, đồng thời và adapter MongoDB không kết nối mạng.");
}

void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
