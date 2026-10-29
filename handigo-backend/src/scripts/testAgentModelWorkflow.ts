import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MemorySaver } from "@langchain/langgraph";
import { z } from "zod";
import type { AgentSession } from "../ai/agent/agent-state";
import type { LLMResponse } from "../ai/llm/llm.interface";
import type { ModelWorkflowPhase } from "../ai/agent/model-workflow";
import { FixtureActionLedger } from "./fixtures/action-ledger.fixture";
import { observeCustomerTurn, type CustomerTurnMetric } from "../ai/runtime/customer-runtime-metrics";
import { inferToolIntent } from "../ai/tools/tool-groups";

class NodeCrashSaver extends MemorySaver {
  crashAfter?: ModelWorkflowPhase;
  readonly phases: ModelWorkflowPhase[] = [];
  override async put(...args: Parameters<MemorySaver["put"]>) {
    const result = await super.put(...args);
    const data = args[1].channel_values.data as { session?: AgentSession } | undefined;
    const phase = data?.session?.modelWorkflow?.phase;
    if (phase) this.phases.push(phase);
    if (phase && phase === this.crashAfter) {
      this.crashAfter = undefined;
      throw new Error("Crash fixture sau commit checkpoint của node.");
    }
    return result;
  }
}

async function run() {
  require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {}, payoutPayos: {} } } as NodeModule;
  const { CustomerWorkflowRuntime } = await import("../ai/runtime/customer-workflow-runtime");
  const { InProcessGraphPilotAccess } = await import("../ai/runtime/agent-runtime");
  const { ToolRegistry } = await import("../ai/tools/tool-registry");
  const user = { id: "1".repeat(24), role: "CUSTOMER" as const };
  for (const [message, intent] of [
    ["Tôi muốn đặt lịch vệ sinh máy lạnh", "booking"],
    ["Cho tôi xem thông tin dịch vụ.", "booking"],
    ["Đổi địa chỉ sang Đại học Việt Hàn Đà Nẵng", "booking"],
    ["Tôi muốn khiếu nại", "complaint"],
    ["Xem phiếu hỗ trợ của tôi", "support"],
    ["Thanh toán đơn ORD-123", "payment"],
    ["Hủy QR, giữ đơn", "payment"],
    ["Trạng thái đơn ORD-123 thế nào?", "order"],
    ["Đơn ORD-123 thế nào?", "order"],
    ["Hủy đơn và hoàn tiền", "order"],
    ["Khiếu nại dịch vụ vừa đặt", undefined],
    ["Đặt dịch vụ và thanh toán", undefined],
    ["Xin chào", undefined],
    ["Cái đó thì sao?", undefined],
  ] as const) assert.equal(inferToolIntent(message), intent, message);
  for (const crashAfter of ["route_tool", "validate_tool", "execute_read", "after_tool", "respond", "done"] as const) {
    const saver = new NodeCrashSaver(), access = new InProcessGraphPilotAccess(), ledger = new FixtureActionLedger();
    let reads = 0, models = 0;
    const registry = new ToolRegistry({}, true).register({ name: "get_service", description: "Đọc dịch vụ fixture.",
      roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false, inputSchema: z.object({ serviceId: z.string() }).strict(),
      execute: async () => { reads++; return { name: "Vệ sinh", serviceType: "fixed_price" }; } });
    const responses: LLMResponse[] = [
      { type: "TOOL_CALL", tool: "get_service", arguments: { serviceId: "2".repeat(24) } },
      { type: "FINAL", message: "Đã đọc thông tin dịch vụ." },
    ];
    const runtime = () => new CustomerWorkflowRuntime({ registry, checkpointer: saver, ledger, access,
      assertWriteAccess: async () => {}, config: { maxIterations: 4, timeoutMs: 2000, systemPrompt: "Kiểm thử node model." },
      mergeMessages: async (session) => session, provider: { generate: async (request) => {
        assert.ok(request.tools.some((tool) => (tool as { name: string }).name === "get_service"), "Nhóm phù hợp có ngay từ lần gọi model đầu.");
        models++; const response = responses.shift(); assert.ok(response, "Không gọi lại model đã có kết quả trong checkpoint."); return response;
      } } });
    const id = randomUUID(), input = { requestId: randomUUID(), message: "Cho tôi xem thông tin dịch vụ." };
    saver.crashAfter = crashAfter;
    await assert.rejects(runtime().send(user, id, input));
    await assert.rejects(runtime().send(user, id, { ...input, message: "Nội dung khác." }));
    let metric: CustomerTurnMetric | undefined;
    const result = await observeCustomerTurn(() => runtime().send(user, id, input), (event) => { metric = event; });
    assert.ok(metric?.stages?.some((item) => item.stage === "checkpoint_read"));
    assert.ok(metric?.stages?.some((item) => item.stage === "checkpoint_write"));
    assert.ok(metric?.stages?.some((item) => item.stage === "merge_messages"));
    if (crashAfter !== "done") assert.ok(metric?.stages?.some((item) => item.stage === "respond"));
    assert.equal(reads, 1, `Không đọc lại sau checkpoint: ${crashAfter}`);
    assert.equal(models, 2, `Bỏ lượt chọn nhóm; không gọi lại model sau checkpoint: ${crashAfter}`);
    assert.equal(result.activeRequest, null);
    assert.equal(result.receipts.length, 1);
    assert.equal(result.conversation.filter((item) => item.role === "user").length, 1);
    assert.equal(result.conversation.filter((item) => item.role === "assistant" && item.content === "Đã đọc thông tin dịch vụ.").length, 1);
    for (const phase of ["call_model", "route_tool", "validate_tool", "execute_read", "after_tool", "respond", "done"] as const) assert.ok(saver.phases.includes(phase));
    await runtime().send(user, id, input);
    assert.equal(models, 2); assert.equal(reads, 1);
  }

  // Câu mơ hồ giữ định tuyến bằng model; nhóm nạp trước vẫn có thể chuyển khi cần.
  for (const message of ["Tôi cần giúp với việc này", "Cho tôi xem dịch vụ"]) {
    const registry = new ToolRegistry({}, true);
    for (const name of ["get_service", "get_support_ticket", "get_payment_status"]) registry.register({
      name, description: "Công cụ kiểm thử nhóm.", roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
      inputSchema: z.object({}).strict(), execute: async () => ({}) });
    let calls = 0;
    const runtime = new CustomerWorkflowRuntime({ registry, checkpointer: new MemorySaver(),
      ledger: new FixtureActionLedger(), access: new InProcessGraphPilotAccess(), assertWriteAccess: async () => {},
      mergeMessages: async (session) => session,
      config: { maxIterations: 3, timeoutMs: 2000, systemPrompt: "Kiểm thử chuyển nhóm." },
      provider: { generate: async (request) => {
        const names = request.tools.map((tool) => (tool as { name: string }).name);
        assert.ok(!names.includes("get_payment_status"), "Không gửi nhóm thanh toán không liên quan.");
        if (calls++ === 0) {
          assert.equal(names.includes("get_service"), message.includes("dịch vụ"));
          assert.ok(!names.includes("get_support_ticket"));
          return { type: "TOOL_CALL", tool: "select_tool_group", arguments: { intent: "support" } };
        }
        assert.ok(names.includes("get_support_ticket"));
        assert.ok(!names.includes("get_service"), "Chuyển nhóm thay thế nhóm cũ, không tích lũy công cụ.");
        return { type: "FINAL", message: "Bạn muốn xem phiếu hỗ trợ nào?" };
      } } });
    await runtime.send(user, randomUUID(), { requestId: randomUUID(), message });
    assert.equal(calls, 2);
  }

  // Bản nháp chỉ cập nhật một lần khi crash sau checkpoint kết quả, trước node chuẩn bị form.
  for (const crashAfter of ["after_tool", "prepare_draft"] as const) {
    const saver = new NodeCrashSaver(), access = new InProcessGraphPilotAccess(), ledger = new FixtureActionLedger();
    let updates = 0, models = 0;
    const registry = new ToolRegistry().register({ name: "update_booking_draft", description: "Cập nhật bản nháp fixture.",
      roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false, inputSchema: z.object({}).strict(),
      execute: async (context) => {
        updates++;
        context.session!.bookingDraft = { revision: updates, status: "active", values: {}, sources: {}, missing: ["Dịch vụ"],
          summary: [], choiceGroups: [{ label: "Dịch vụ", multiple: false, options: ["Chọn dịch vụ"] }] };
        return { revision: updates };
      } });
    const runtime = () => new CustomerWorkflowRuntime({ registry, checkpointer: saver, ledger, access,
      assertWriteAccess: async () => {}, config: { maxIterations: 2, timeoutMs: 2000, systemPrompt: "Kiểm thử node bản nháp." },
      mergeMessages: async (session) => session, provider: { generate: async () => {
        models++; return { type: "TOOL_CALL" as const, tool: "update_booking_draft", arguments: {} };
      } } });
    const id = randomUUID(), input = { requestId: randomUUID(), message: "Tôi muốn chuẩn bị dịch vụ." };
    saver.crashAfter = crashAfter;
    await assert.rejects(runtime().send(user, id, input));
    const result = await runtime().send(user, id, input);
    assert.equal(updates, 1); assert.equal(models, 1);
    assert.equal(result.bookingDraft?.revision, 1);
    assert.equal(result.state, "WAITING_USER_INPUT");
    assert.ok(saver.phases.includes("prepare_draft"));
  }
  {
    const saver = new NodeCrashSaver(), access = new InProcessGraphPilotAccess(), ledger = new FixtureActionLedger();
    let models = 0, writes = 0;
    const registry = new ToolRegistry().register({ name: "cancel_support_ticket", description: "Xác nhận fixture.",
      roles: ["CUSTOMER"], mutates: true, requiresConfirmation: true,
      inputSchema: z.object({ ticketId: z.string() }).strict(),
      preview: async () => ({ title: "Hủy hỗ trợ", status: "open" }),
      execute: async () => { writes++; return {}; } });
    const runtime = () => new CustomerWorkflowRuntime({ registry, checkpointer: saver, ledger, access,
      assertWriteAccess: async () => {}, config: { maxIterations: 2, timeoutMs: 2000, systemPrompt: "Kiểm thử xác nhận." },
      mergeMessages: async (session) => session, provider: { generate: async () => {
        models++; return { type: "TOOL_CALL" as const, tool: "cancel_support_ticket", arguments: { ticketId: "2".repeat(24) } };
      } } });
    const id = randomUUID(), input = { requestId: randomUUID(), message: "Tôi muốn dừng yêu cầu hỗ trợ." };
    saver.crashAfter = "prepare_confirmation";
    await assert.rejects(runtime().send(user, id, input));
    const result = await runtime().send(user, id, input);
    assert.equal(models, 1); assert.equal(writes, 0);
    assert.equal(result.state, "WAITING_CONFIRMATION");
    assert.equal(result.pendingAction?.status, "WAITING_CONFIRMATION");
    assert.equal(ledger.records.size, 0, "Graph model không tự cấp quyền gọi service ghi.");
  }
  // Formatter của tool đọc phải được chốt cùng kết quả, trước khi host lưu receipt.
  {
    const saver = new NodeCrashSaver(), access = new InProcessGraphPilotAccess(), ledger = new FixtureActionLedger();
    let models = 0, reads = 0;
    const registry = new ToolRegistry().register({ name: "get_system_info", description: "Thông tin fixture.",
      roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false, inputSchema: z.object({}).strict(),
      execute: async () => { reads++; return { message: "Thông tin hệ thống đã xác minh." }; },
      reply: (result) => ({ state: "WAITING_USER_INPUT", message: (result as { message: string }).message }) });
    const runtime = () => new CustomerWorkflowRuntime({ registry, checkpointer: saver, ledger, access,
      assertWriteAccess: async () => {}, config: { maxIterations: 2, timeoutMs: 2000, systemPrompt: "Kiểm thử formatter." },
      mergeMessages: async (session) => session, provider: { generate: async () => {
        models++; return { type: "TOOL_CALL" as const, tool: "get_system_info", arguments: {} };
      } } });
    const id = randomUUID(), input = { requestId: randomUUID(), message: "Cho tôi thông tin hệ thống." };
    saver.crashAfter = "done";
    await assert.rejects(runtime().send(user, id, input));
    const result = await runtime().send(user, id, input);
    assert.equal(models, 1); assert.equal(reads, 1);
    assert.equal(result.conversation.filter((item) => item.role === "assistant" && item.content === "Thông tin hệ thống đã xác minh.").length, 1);
  }
  console.log("Đạt graph model: node định tuyến/model/tool/bản nháp, checkpoint từng bước, crash sau commit, phục hồi không lặp model/đọc/sửa nháp và receipt.");
}
void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
