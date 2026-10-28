import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { z } from "zod";
import { agentContext, compactAgentContext } from "../ai/agent/agent-context";
import { newSession, type AgentMessage } from "../ai/agent/agent-state";
import { invalidateReadSnapshots } from "../ai/agent/read-source-refresh";

async function run() {
  const session = newSession(randomUUID(), "1".repeat(24));
  const append = (role: AgentMessage["role"], content: string, tool?: string) => {
    const message = { id: randomUUID(), role, content, tool, createdAt: new Date().toISOString() };
    session.conversation.push(message);
    return message;
  };
  session.bookingDraft = { revision: 20, status: "active", values: { serviceId: "2".repeat(24),
    uniformQuantity: 2, paymentMethod: "wallet", addressId: "3".repeat(24) }, sources: {},
    summary: ["Địa chỉ và số lượng khách đã chọn"], missing: ["Ngày giờ"], choiceGroups: [],
    availableVouchers: Array.from({ length: 60 }, (_, index) => ({ code: `MA-${index}`, name: "Mã ưu đãi kiểm thử",
      discountAmount: index * 1000, finalAmount: 200000 - index * 1000 })),
    providerCandidates: Array.from({ length: 30 }, (_, index) => ({ id: index.toString().padStart(24, "0"), name: `Thợ kiểm thử ${index}` })) };
  for (let index = 0; index < 20; index++) {
    append("user", `Sửa số lượng lần ${index}, không đổi địa chỉ đã chọn.`);
    append("tool", JSON.stringify({ ...session.bookingDraft, revision: index }), "update_booking_draft");
  }
  const latest = append("user", "Chọn buổi sáng, vẫn thanh toán ví.");
  Object.assign(latest, { customerAttachments: ["https://example.com/anh-kiem-thu.jpg"],
    choiceGroups: [{ label: "Giờ hẹn", multiple: false, options: ["09:00", "10:00"] }] });
  const before = structuredClone(session);
  const legacy: AgentMessage[] = [];
  let length = 0;
  for (const message of [...session.conversation].reverse()) {
    const size = JSON.stringify(message).length;
    if (legacy.length >= 40 || (legacy.length && length + size > 48000)) break;
    legacy.unshift(message); length += size;
  }
  const context = agentContext(session);
  const oldSize = JSON.stringify({ conversation: legacy, bookingDraft: session.bookingDraft }).length;
  const newSize = JSON.stringify({ conversation: context.conversation, bookingDraft: context.taskContext.bookingDraft }).length;
  assert(newSize < oldSize * 0.5, "Bản nháp lặp phải giảm ít nhất một nửa dữ liệu gửi model trong fixture.");
  assert.deepEqual(context.taskContext.bookingDraft, before.bookingDraft, "Giữ đầy đủ giá trị và lựa chọn trong state hiện tại.");
  assert.deepEqual(context.conversation[context.conversation.length - 1], latest, "Giữ nguyên yêu cầu, lựa chọn và ảnh của khách.");
  assert.deepEqual(session, before, "Chuẩn bị ngữ cảnh không sửa lịch sử hoặc bản nháp.");
  assert.equal(context.goal, latest.content);
  const error = append("tool", JSON.stringify({ revision: 20, error: "Chưa thể đọc lịch trống." }), "update_booking_draft");
  const quote = append("tool", JSON.stringify({ orderId: "4".repeat(24), amount: 250000, status: "pending" }), "get_booking_quotation");
  for (const expected of [error, quote]) {
    assert.deepEqual(agentContext(session).conversation.find(message => message.id === expected.id), expected);
  }

  // Hội thoại dài: ghi nhớ không phải chờ nhà cung cấp và không đưa trạng thái công cụ cũ vào tóm tắt.
  const history = newSession(randomUUID(), session.userId);
  for (let index = 0; index < 80; index++) history.conversation.push({ id: randomUUID(), role: index % 2 ? "tool" : "user",
    content: index % 2 ? '{"status":"paid","orderId":"khong-duoc-coi-la-hien-tai"}' : `Yêu cầu kiểm thử ${index}`,
    tool: index % 2 ? "get_payment_status" : undefined, createdAt: new Date().toISOString() });
  history.conversation.push({ ...latest, id: randomUUID(), content: "Tôi muốn xem thêm thông tin." });
  const historyBefore = structuredClone(history.conversation);
  const started = performance.now();
  compactAgentContext(history, AbortSignal.timeout(5000));
  const compactionMs = performance.now() - started;
  assert(history.contextSummary?.content.includes("Yêu cầu kiểm thử"));
  assert(!history.contextSummary?.content.includes("khong-duoc-coi-la-hien-tai"));
  assert(history.contextSummary!.content.length <= 4000);
  assert.deepEqual(history.conversation, historyBefore);
  const summaryBefore = structuredClone(history.contextSummary);
  compactAgentContext(history, AbortSignal.timeout(5000));
  assert.deepEqual(history.contextSummary, summaryBefore, "Không thêm lặp trích đoạn đã ghi nhớ.");
  assert.throws(() => compactAgentContext(history, AbortSignal.abort()));

  require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {}, payoutPayos: {} } } as NodeModule;
  const { AgentLoop } = await import("../ai/agent/agent-loop.service");
  const { AgentModelWorkflow } = await import("../ai/agent/model-workflow");
  const { runCustomerModelGraph } = await import("../ai/graphs/customer-model.graph");
  const { ToolRegistry } = await import("../ai/tools/tool-registry");
  const registry = new ToolRegistry().register({ name: "get_system_info", description: "Thông tin kiểm thử.",
    roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false, inputSchema: z.object({}), execute: async () => ({}) });
  let calls = 0;
  const host = new AgentLoop({ generate: async request => {
    calls++;
    assert(request.tools.length > 0, "Không gọi model riêng chỉ để tóm tắt.");
    return { type: "FINAL", message: "Bạn muốn biết thêm thông tin nào?" };
  } }, registry, { maxIterations: 2, timeoutMs: 1000, systemPrompt: "Kiểm thử tối ưu ngữ cảnh." });
  history.activeRequest = { requestId: randomUUID(), digest: "kiem-thu", input: { requestId: randomUUID(), message: latest.content } };
  history.contextSummary = undefined;
  await runCustomerModelGraph(new AgentModelWorkflow(host, history, { user: { id: history.userId, role: "CUSTOMER" },
    sessionId: history.id, session: history, signal: AbortSignal.timeout(5000) }, async () => {}, true));
  assert.equal(calls, 1, "Hội thoại dài vẫn chỉ có một lượt model cho câu trả lời trực tiếp.");
  invalidateReadSnapshots(history);
  assert.equal(history.contextSummary, undefined, "Khôi phục vẫn vô hiệu ghi nhớ cũ.");
  console.log(`Đạt ngữ cảnh agent: dữ liệu fixture ${oldSize} → ${newSize} ký tự; gộp lịch sử ${compactionMs.toFixed(1)} ms; giữ state/lựa chọn/ảnh, lỗi/nguồn đọc, lịch sử gốc và không gọi model để tóm tắt.`);
}
void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
