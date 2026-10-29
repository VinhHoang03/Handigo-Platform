import assert from "node:assert/strict";
import { mock } from "node:test";
import { randomUUID } from "node:crypto";
import { MemorySaver } from "@langchain/langgraph";
import type { AgentTool } from "../ai/tools/tool.interface";
import type { AgentSession } from "../ai/agent/agent-state";
import type { LLMRequest, LLMResponse } from "../ai/llm/llm.interface";
import { FixtureActionLedger } from "./fixtures/action-ledger.fixture";
import { AppError } from "../utils/appError";

// Giữ runtime/tool thật; chỉ thay biên model, service và kho dữ liệu để không ghi nghiệp vụ thật.
async function run() {
  require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {}, payoutPayos: {} } } as NodeModule;
  const { CustomerWorkflowRuntime } = await import("../ai/runtime/customer-workflow-runtime");
  const { InProcessGraphPilotAccess } = await import("../ai/runtime/agent-runtime");
  const { ToolRegistry } = await import("../ai/tools/tool-registry");
  const { AgentBookingService } = await import("../services/agentBooking.service");
  const { AgentOrderProviderService } = await import("../services/agentOrderProvider.service");
  const { AgentQuotationService } = await import("../services/agentQuotation.service");
  const { AgentFeedbackService } = await import("../services/agentFeedback.service");
  const { AgentAddressService } = await import("../services/agentAddress.service");
  const { AgentCustomerCareService: care } = await import("../services/agentCustomerCare.service");
  const { AgentPaymentService } = await import("../services/agentPayment.service");
  const { cancelBookingTool } = await import("../ai/tools/implementations/cancel-booking.tool");
  const { selectOrderProviderTool, respondProviderReassignmentTool } = await import("../ai/tools/implementations/order-provider.tools");
  const { rejectBookingQuotationTool } = await import("../ai/tools/implementations/quotation.tools");
  const { submitBookingFeedbackTool } = await import("../ai/tools/implementations/feedback.tools");
  const { saveBookingAddressTool } = await import("../ai/tools/implementations/booking-extras.tools");
  const { replySupportTicketTool } = await import("../ai/tools/implementations/reply-support-ticket.tool");
  const { cancelSupportTicketTool } = await import("../ai/tools/implementations/cancel-support-ticket.tool");
  const { createComplaintTool } = await import("../ai/tools/implementations/create-complaint.tool");
  const { addComplaintEvidenceTool } = await import("../ai/tools/implementations/complaint-evidence.tool");
  const { cancelComplaintTool } = await import("../ai/tools/implementations/cancel-complaint.tool");
  const { cancelPaymentTool } = await import("../ai/tools/implementations/payment.tools");
  const user = { id: "1".repeat(24), role: "CUSTOMER" as const };
  const orderId = "2".repeat(24), resourceId = "3".repeat(24), providerId = "4".repeat(24);
  const image = "https://example.invalid/anh-kiem-thu.jpg";
  const result = { orderId, orderCode: "HD-MATRIX", id: resourceId, statusLabel: "Đã cập nhật",
    addressId: resourceId, message: "Đã xử lý yêu cầu.", status: "unpaid", amount: 100000, paymentType: "full" };
  type Scenario = { label: string; tool: Pick<AgentTool, "name">; args: Record<string, unknown>; images?: boolean };
  const scenarios: Scenario[] = [
    { label: "hủy đơn", tool: cancelBookingTool, args: { orderId, reason: "Không còn nhu cầu sử dụng" } },
    { label: "chọn thợ", tool: selectOrderProviderTool, args: { orderId, providerId } },
    ...(["accept", "decline"] as const).map((decision) => ({ label: `đổi thợ ${decision}`,
      tool: respondProviderReassignmentTool, args: { orderId, decision } })),
    { label: "từ chối báo giá", tool: rejectBookingQuotationTool, args: { orderId, reason: "Chi phí không phù hợp" } },
    ...(["create", "update"] as const).map((mode) => ({ label: `đánh giá ${mode}`, tool: submitBookingFeedbackTool,
      args: { orderId, mode, rating: 4, comment: "Dịch vụ đã hoàn thành." }, images: true })),
    { label: "sửa địa chỉ", tool: saveBookingAddressTool, args: { addressId: resourceId, addressText: "Địa chỉ mới của khách", useForBooking: false } },
    { label: "phản hồi hỗ trợ", tool: replySupportTicketTool, args: { ticketId: resourceId, message: "Tôi gửi thêm thông tin cần kiểm tra." }, images: true },
    { label: "hủy hỗ trợ", tool: cancelSupportTicketTool, args: { ticketId: resourceId } },
    { label: "tạo khiếu nại", tool: createComplaintTool, args: { orderId, title: "Cần kiểm tra chất lượng", description: "Dịch vụ chưa đạt chất lượng như yêu cầu." }, images: true },
    { label: "bổ sung bằng chứng", tool: addComplaintEvidenceTool, args: { complaintId: resourceId, note: "Ảnh hiện trạng sau dịch vụ." }, images: true },
    { label: "hủy khiếu nại", tool: cancelComplaintTool, args: { complaintId: resourceId } },
    { label: "hủy QR", tool: cancelPaymentTool, args: { orderId, paymentId: resourceId } },
  ];
  try {
    for (const scenario of scenarios) {
      const saver = new MemorySaver(), ledger = new FixtureActionLedger(), access = new InProcessGraphPilotAccess();
      let version = 1, writes = 0, modelCalls = 0, committed = false, loseServiceReply = false, sourceAvailable = true;
      let beforeWrite: (() => Promise<void>) | undefined;
      const preview = () => ({ version, orderId, paymentId: resourceId, amount: 100000, paymentType: "full",
        paidAmount: 100000, refundAmount: 90000, cancellationFee: 10000 });
      const stub = (service: object, method: string, kind: "preview" | "write" | "reconcile", expectedIndex?: number) => {
        mock.method(service as Record<string, (...args: unknown[]) => Promise<unknown>>, method, async (...args: unknown[]) => {
          const owner = args[0];
          assert.equal(typeof owner === "string" ? owner : (owner as { id: string }).id, user.id);
          if (kind === "preview") return preview();
          if (kind === "reconcile") return committed && sourceAvailable ? result : null;
          assert.ok([...ledger.records.values()].some((item) => item.status === "EXECUTING" && item.tool === scenario.tool.name),
            `${scenario.label}: service ghi chỉ chạy sau giành ledger`);
          if (expectedIndex !== undefined) {
            const expected = args[expectedIndex] as Record<string, unknown>;
            assert.equal(expected.refundAmount, 90000);
          }
          if (scenario.images) assert.ok(JSON.stringify(args).includes(image), `${scenario.label}: giữ ảnh đã xác nhận`);
          await beforeWrite?.();
          writes++; committed = true;
          if (loseServiceReply) throw new Error("Mất phản hồi service sau ghi fixture.");
          return result;
        });
      };
      stub(AgentBookingService, "previewCancel", "preview"); stub(AgentBookingService, "cancel", "write", 3);
      stub(AgentBookingService, "reconcileCancellation", "reconcile");
      stub(AgentOrderProviderService, "previewSelect", "preview"); stub(AgentOrderProviderService, "select", "write", 3);
      stub(AgentOrderProviderService, "reconcileSelection", "reconcile");
      stub(AgentOrderProviderService, "previewResponse", "preview"); stub(AgentOrderProviderService, "respond", "write", 3);
      stub(AgentOrderProviderService, "reconcileResponse", "reconcile");
      stub(AgentQuotationService, "previewReject", "preview"); stub(AgentQuotationService, "reject", "write", 3);
      stub(AgentQuotationService, "reconcileRejection", "reconcile");
      stub(AgentFeedbackService, "preview", "preview"); stub(AgentFeedbackService, "submit", "write", 2);
      stub(AgentFeedbackService, "reconcile", "reconcile");
      stub(AgentAddressService, "preview", "preview"); stub(AgentAddressService, "save", "write", 2);
      stub(AgentAddressService, "reconcile", "reconcile");
      for (const method of ["previewTicketAction", "previewComplaint", "previewEvidence", "previewCancelComplaint"]) stub(care, method, "preview");
      for (const method of ["respond", "cancelTicket", "createComplaint", "addEvidence", "cancelComplaint"]) stub(care, method, "write");
      for (const method of ["reconcileResponse", "reconcileCreated", "reconcileEvidence", "reconcileCancellation"]) stub(care, method, "reconcile");
      stub(AgentPaymentService, "previewCancellation", "preview"); stub(AgentPaymentService, "cancel", "write", 2);
      mock.method(AgentPaymentService, "status", async () => result as never);
      mock.method(AgentPaymentService, "cancellationConfirmed", async (_owner: unknown, _current: unknown, paymentId: string) => {
        assert.equal(paymentId, resourceId);
        return committed && sourceAvailable;
      });
      const registry = new ToolRegistry().register(cancelBookingTool).register(selectOrderProviderTool)
        .register(respondProviderReassignmentTool).register(rejectBookingQuotationTool).register(submitBookingFeedbackTool)
        .register(saveBookingAddressTool).register(replySupportTicketTool).register(cancelSupportTicketTool)
        .register(createComplaintTool).register(addComplaintEvidenceTool).register(cancelComplaintTool).register(cancelPaymentTool);
      const runtime = () => new CustomerWorkflowRuntime({ registry, checkpointer: saver, ledger, access,
        assertWriteAccess: async () => {}, config: { maxIterations: 2, timeoutMs: 2000, systemPrompt: "Trợ lý kiểm thử ma trận." },
        mergeMessages: async (session) => session,
        provider: { generate: async (request: LLMRequest): Promise<LLMResponse> => {
          modelCalls++;
          const last = request.conversation[request.conversation.length - 1];
          return last?.role === "user" && last.content === "Thực hiện yêu cầu đã chọn."
            ? { type: "TOOL_CALL", tool: scenario.tool.name, arguments: scenario.args }
            : { type: "FINAL", message: "Đã kiểm tra yêu cầu." };
        } },
      });
      const prepare = async () => {
        const id = randomUUID();
        if (scenario.images) await runtime().registerAttachment(user, id, image);
        const session = await runtime().send(user, id, { requestId: randomUUID(), message: "Thực hiện yêu cầu đã chọn.",
          ...(scenario.images ? { customerAttachments: [image] } : {}) });
        assert.equal(session.state, "WAITING_CONFIRMATION", scenario.label);
        assert.equal(session.pendingAction?.tool, scenario.tool.name);
        if (scenario.images) assert.deepEqual((session.pendingAction!.arguments as { customerAttachments: string[] }).customerAttachments, [image]);
        return { id, input: { requestId: randomUUID(), confirmation: { actionId: session.pendingAction!.id, decision: "CONFIRM" as const } } };
      };
      const assertFinished = (session: AgentSession, actionId: string) => {
        assert.equal(session.requiresReconciliation, false, scenario.label);
        assert.equal(session.activeRequest, null, scenario.label);
        assert.equal(session.actions.filter((item) => item.id === actionId && item.status === "SUCCEEDED").length, 1, scenario.label);
        assert.equal(session.conversation.filter((item) => item.id === `action:${actionId}:tool`).length, 1, scenario.label);
        assert.ok([...ledger.records.values()].filter((item) => item.sessionId === session.id).every((item) => !item.active));
      };

      const normal = await prepare();
      assert.equal(writes, 0, `${scenario.label}: preview không ghi`);
      assertFinished(await runtime().send(user, normal.id, normal.input), normal.input.confirmation.actionId);
      const modelsBeforeReplay = modelCalls;
      await runtime().send(user, normal.id, normal.input);
      assert.equal(writes, 1); assert.equal(modelCalls, modelsBeforeReplay);
      const rejected = await prepare();
      const rejection = await runtime().send(user, rejected.id, { ...rejected.input, confirmation: { ...rejected.input.confirmation, decision: "REJECT" } });
      assert.ok(rejection.actions.some((item) => item.status === "REJECTED"));
      assert.equal(writes, 1, `${scenario.label}: từ chối không ghi`);
      const changed = await prepare(); version++;
      const refreshed = await runtime().send(user, changed.id, changed.input);
      assert.equal(refreshed.state, "WAITING_CONFIRMATION");
      assert.notEqual(refreshed.pendingAction?.id, changed.input.confirmation.actionId);
      assert.equal(writes, 1, `${scenario.label}: preview đổi phải xác nhận lại`);

      const crash = await prepare(); ledger.loseResultFor = scenario.tool.name;
      await assert.rejects(runtime().send(user, crash.id, crash.input));
      assert.equal(writes, 2);
      assertFinished(await runtime().send(user, crash.id, crash.input), crash.input.confirmation.actionId);
      await runtime().send(user, crash.id, crash.input);
      assert.equal(writes, 2, `${scenario.label}: khôi phục ledger không thực thi lại`);

      const unknown = await prepare(); loseServiceReply = true; sourceAvailable = false;
      const uncertain = await runtime().send(user, unknown.id, unknown.input);
      assert.equal(uncertain.requiresReconciliation, true);
      assert.equal(writes, 3);
      const stillUnknown = await runtime().send(user, unknown.id, { requestId: randomUUID(), message: "Kiểm tra kết quả trước." });
      assert.equal(stillUnknown.requiresReconciliation, true, `${scenario.label}: nguồn chưa xác nhận không mở khóa`);
      sourceAvailable = true;
      const reconciled = await runtime().send(user, unknown.id, { requestId: randomUUID(), message: "Kiểm tra kết quả trước." });
      assertFinished(reconciled, unknown.input.confirmation.actionId);
      assert.equal(writes, 3, `${scenario.label}: đối soát không ghi lại`);
      loseServiceReply = false;
      const concurrent = await prepare();
      let entered!: () => void, release!: () => void;
      const started = new Promise<void>((resolve) => { entered = resolve; });
      const gate = new Promise<void>((resolve) => { release = resolve; });
      beforeWrite = async () => { entered(); await gate; };
      const first = runtime().send(user, concurrent.id, concurrent.input);
      // Không chờ bằng sleep: chỉ tranh xác nhận khi service lần đầu đã bắt đầu xử lý.
      try {
        await Promise.race([started, first.then(() => { throw new Error("Thiếu thao tác ghi trong ca đồng thời."); })]);
        await assert.rejects(runtime().send(user, concurrent.id, concurrent.input),
          (error: unknown) => error instanceof AppError && error.statusCode === 409);
        await assert.rejects(runtime().send(user, concurrent.id, { ...concurrent.input, requestId: randomUUID() }),
          (error: unknown) => error instanceof AppError && error.statusCode === 409);
      } finally { release(); await first; }
      assertFinished(await runtime().send(user, concurrent.id, concurrent.input), concurrent.input.confirmation.actionId);
      assert.equal(writes, 4, `${scenario.label}: xác nhận đồng thời chỉ ghi một lần`);
      console.log(`Đạt ma trận engine nghiệp vụ: ${scenario.label}.`);
      mock.restoreAll();
    }
    console.log(`Đạt ${scenarios.length} nhánh qua runtime/tool thật: xác nhận, từ chối, preview đổi, replay, crash ledger, đối soát UNKNOWN và xác nhận đồng thời.`);
  } finally { mock.restoreAll(); }
}
void run().catch((error: unknown) => { mock.restoreAll(); console.error(error); process.exitCode = 1; });
