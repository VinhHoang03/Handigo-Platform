import assert from "node:assert/strict";
import { mock } from "node:test";
import { randomUUID } from "node:crypto";
import { MemorySaver } from "@langchain/langgraph";
import type { AgentSession } from "../ai/agent/agent-state";
import { FixtureActionLedger } from "./fixtures/action-ledger.fixture";
import { AppError } from "../utils/appError";

class ReceiptCrashSaver extends MemorySaver {
  failReceiptFor?: string;
  override async put(...args: Parameters<MemorySaver["put"]>) {
    const data = args[1].channel_values.data as { session?: AgentSession } | undefined;
    if (this.failReceiptFor && data?.session?.receipts.some((item) => item.requestId === this.failReceiptFor)) {
      this.failReceiptFor = undefined;
      throw new Error("Crash fixture trước lưu receipt, sau lưu kết quả.");
    }
    return super.put(...args);
  }
}

async function run() {
  require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {}, payoutPayos: {} } } as NodeModule;
  const { CustomerWorkflowRuntime, buildCustomerSessionGraph } = await import("../ai/runtime/customer-workflow-runtime");
  const { observeCustomerTurn } = await import("../ai/runtime/customer-runtime-metrics");
  const { InProcessGraphPilotAccess } = await import("../ai/runtime/agent-runtime");
  const { ToolRegistry } = await import("../ai/tools/tool-registry");
  const { sessionView } = await import("../ai/agent/agent.service");
  const { createPaymentTool, getPaymentStatusTool } = await import("../ai/tools/implementations/payment.tools");
  const { AgentPaymentService } = await import("../services/agentPayment.service");
  const { AgentCustomerCareService } = await import("../services/agentCustomerCare.service");
  const { createSupportTicketTool } = await import("../ai/tools/implementations/create-support-ticket.tool");
  const progress = await import("../services/agentOrderProgress.service");
  const { bookingSchema } = await import("../ai/tools/implementations/booking.schemas");
  const user = { id: "1".repeat(24), role: "CUSTOMER" as const };
  const orderId = "2".repeat(24), policyVersion = "a".repeat(64);
  const paymentResult = { orderId, orderCode: "HD-GRAPH", paymentId: "3".repeat(24), amount: 100000,
    paymentType: "full", method: "wallet", status: "paid" as const, message: "Đã thanh toán thành công." };
  let payments = 0, bookings = 0, modelCalls = 0, careWrites = 0;
  let failPayment = false;
  mock.method(progress, "combineAgentBookingPayment", async () => {});
  mock.method(AgentPaymentService, "preview", async () => ({ amount: 100000, paymentType: "full", paymentMethod: "wallet" }) as never);
  mock.method(AgentPaymentService, "pay", async () => {
    payments++;
    if (failPayment) throw new Error("Mất kết nối sau ghi thanh toán.");
    return paymentResult;
  });
  mock.method(AgentPaymentService, "status", async () => paymentResult);
  mock.method(AgentCustomerCareService, "createTicket", async (_owner: string, args: { customerAttachments?: string[] }) => {
    careWrites++;
    assert.deepEqual(args.customerAttachments, ["https://example.invalid/anh-ho-tro.jpg"]);
    return { id: "4".repeat(24), title: "Cần hỗ trợ tài khoản", status: "open", statusLabel: "Mới tiếp nhận" } as never;
  });
  try {
    const saver = new ReceiptCrashSaver();
    const access = new InProcessGraphPilotAccess();
    const ledger = new FixtureActionLedger();
    const when = new Date(Date.now() + 3 * 86400000); when.setUTCHours(3, 0, 0, 0);
    const bookingArgs = { serviceId: "5".repeat(24), addressId: "6".repeat(24), orderType: "scheduled" as const,
      scheduledAt: when.toISOString(), paymentMethod: "wallet" };
    const registry = new ToolRegistry().register(createPaymentTool).register(getPaymentStatusTool).register(createSupportTicketTool)
      .register({ name: "create_booking", description: "Tạo đơn sau xác nhận.", roles: ["CUSTOMER"], inputSchema: bookingSchema,
        mutates: true, requiresConfirmation: true,
        preview: async () => ({ amount: 100000, addressVersion: "v1", policyVersion,
          paymentOnConfirmation: true, paymentMethod: "wallet", serviceType: "fixed_price" }),
        execute: async () => {
          bookings++;
          assert.ok([...ledger.records.values()].some((record) => record.tool === "create_booking" && record.status === "EXECUTING"));
          return { orderId, orderCode: "HD-GRAPH", orderType: "scheduled", bookingStatus: "awaiting_payment", paymentMethod: "wallet" };
        },
        reconcile: async () => bookings ? { orderId, orderCode: "HD-GRAPH", orderType: "scheduled", bookingStatus: "awaiting_payment", paymentMethod: "wallet" } : null,
      });
    let mode: "booking" | "payment" | "care" = "booking";
    const deps = { registry, checkpointer: saver, ledger, access, assertWriteAccess: async () => {},
      config: { maxIterations: 2, timeoutMs: 2000, systemPrompt: "Trợ lý kiểm thử nghiệp vụ." },
      mergeMessages: async (session: AgentSession) => session,
      provider: { generate: async () => {
        modelCalls++;
        return mode === "booking" ? { type: "TOOL_CALL" as const, tool: "create_booking", arguments: bookingArgs }
          : mode === "payment" ? { type: "TOOL_CALL" as const, tool: "create_payment", arguments: { orderId, method: "WALLET" } }
            : { type: "TOOL_CALL" as const, tool: "create_support_ticket", arguments: {
              category: "ACCOUNT", subject: "Cần hỗ trợ tài khoản", description: "Tôi muốn kiểm tra thông tin tài khoản." } };
      } },
    };
    const runtime = () => new CustomerWorkflowRuntime(deps);
    const read = async (id: string) => access.exclusive(user, id, async (threadId) =>
      structuredClone((await buildCustomerSessionGraph(saver).getState({ configurable: { thread_id: threadId } })).values.data.session));

    const id = randomUUID();
    const prepared = await runtime().send(user, id, { requestId: randomUUID(), message: "Đặt dịch vụ và thanh toán bằng ví." });
    assert.equal(prepared.state, "WAITING_CONFIRMATION");
    assert.equal(bookings, 0); assert.equal(payments, 0);
    const confirm = { requestId: randomUUID(), confirmation: { actionId: prepared.pendingAction!.id, decision: "CONFIRM" as const,
      policyConsent: { accepted: true as const, version: policyVersion } } };
    const done = await runtime().send(user, id, confirm);
    assert.equal(bookings, 1); assert.equal(payments, 1);
    assert.equal(done.actions.filter((action) => action.status === "SUCCEEDED").length, 2);
    assert.equal(sessionView(done).payment?.status, "paid");
    assert.equal(done.activeRequest, null);
    const usedModels = modelCalls;
    const replay = await runtime().send(user, id, confirm);
    assert.equal(bookings, 1); assert.equal(payments, 1); assert.equal(modelCalls, usedModels);
    assert.deepEqual(replay, done);
    const metrics: unknown[] = [];
    assert.equal(await observeCustomerTurn(async () => done, (event) => metrics.push(event)), done);
    assert.deepEqual(Object.keys(metrics[0] as object).sort(), ["durationMs", "engine", "interrupted", "outcome", "requiresReconciliation", "state", "version"]);
    assert.ok(!JSON.stringify(metrics).includes(user.id));
    assert.ok(!JSON.stringify(metrics).includes(orderId));
    const rejected = new AppError("Nội dung lỗi chứa dữ liệu riêng tư không được ghi log.", 409);
    await assert.rejects(observeCustomerTurn(async () => { throw rejected; }, (event) => metrics.push(event)), (error: unknown) => error === rejected);
    assert.ok(!JSON.stringify(metrics).includes(rejected.message));
    assert.equal((metrics[1] as { outcome: string }).outcome, "rejected");
    assert.equal(await observeCustomerTurn(async () => done, () => { throw new Error("Logger fixture lỗi."); }), done);
    await assert.rejects(runtime().send(user, id, { ...confirm, confirmation: { ...confirm.confirmation, decision: "REJECT" } }));
    await assert.rejects(runtime().send({ ...user, id: "9".repeat(24) }, id, confirm));
    await assert.rejects(runtime().send({ ...user, role: "PROVIDER" }, id, confirm));

    // Crash sau ghi ledger của thanh toán: checkpoint còn pending; dựng runtime mới chỉ đọc lại kết quả.
    const crashId = randomUUID();
    const beforeCrash = await runtime().send(user, crashId, { requestId: randomUUID(), message: "Đặt thêm dịch vụ bằng ví." });
    const crashConfirm = { ...confirm, requestId: randomUUID(), confirmation: { ...confirm.confirmation, actionId: beforeCrash.pendingAction!.id } };
    ledger.loseResultFor = "create_payment";
    await assert.rejects(runtime().send(user, crashId, crashConfirm));
    assert.equal((await read(crashId)).pendingAction?.tool, "create_payment");
    const beforeResume = { bookings, payments };
    const resumed = await runtime().send(user, crashId, crashConfirm);
    assert.equal(resumed.requiresReconciliation, false);
    assert.equal(resumed.activeRequest, null);
    assert.equal(bookings, beforeResume.bookings); assert.equal(payments, beforeResume.payments);
    assert.equal(resumed.conversation.filter((item) => item.role === "user" && item.content === "Xác nhận.").length, 1);

    mode = "payment"; failPayment = true;
    const unknownId = randomUUID();
    const paymentPreview = await runtime().send(user, unknownId, { requestId: randomUUID(), message: "Thanh toán đơn này bằng ví." });
    const uncertain = await runtime().send(user, unknownId, { requestId: randomUUID(), confirmation: {
      actionId: paymentPreview.pendingAction!.id, decision: "CONFIRM" } });
    assert.equal(uncertain.requiresReconciliation, true);
    assert.ok([...ledger.records.values()].some((item) => item.sessionId === unknownId && item.status === "UNKNOWN"));
    const countBeforeCheck = payments;
    const reconciled = await runtime().send(user, unknownId, { requestId: randomUUID(), paymentStatus: { orderId } });
    assert.equal(reconciled.requiresReconciliation, false);
    assert.equal(payments, countBeforeCheck);
    assert.ok([...ledger.records.values()].filter((item) => item.sessionId === unknownId).every((item) => !item.active));

    mode = "care";
    const careId = randomUUID(), image = "https://example.invalid/anh-ho-tro.jpg";
    await runtime().requireAttachmentSupport(user, careId);
    await runtime().registerAttachment(user, careId, image);
    const carePreview = await runtime().send(user, careId, { requestId: randomUUID(), message: "Gửi hỗ trợ với ảnh này.", customerAttachments: [image] });
    assert.deepEqual((carePreview.pendingAction!.arguments as { customerAttachments: string[] }).customerAttachments, [image]);
    await assert.rejects(runtime().registerAttachment(user, careId, "https://example.invalid/anh-khac.jpg"));
    const careConfirm = { requestId: randomUUID(), confirmation: { actionId: carePreview.pendingAction!.id, decision: "CONFIRM" as const } };
    const sentCare = await runtime().send(user, careId, careConfirm);
    assert.equal(careWrites, 1); assert.equal(sentCare.state, "COMPLETED");
    const careMessages = sessionView(sentCare).messages;
    assert.match(careMessages[careMessages.length - 1].content, /Mã yêu cầu/);
    await runtime().send(user, careId, careConfirm);
    assert.equal(careWrites, 1);
    const receiptCrashId = randomUUID();
    await runtime().registerAttachment(user, receiptCrashId, image);
    const receiptPreview = await runtime().send(user, receiptCrashId, { requestId: randomUUID(), message: "Gửi hỗ trợ với ảnh.", customerAttachments: [image] });
    const receiptConfirm = { requestId: randomUUID(), confirmation: { actionId: receiptPreview.pendingAction!.id, decision: "CONFIRM" as const } };
    saver.failReceiptFor = receiptConfirm.requestId;
    await assert.rejects(runtime().send(user, receiptCrashId, receiptConfirm));
    const countAtCrash = { careWrites, modelCalls };
    const receiptRecovered = await runtime().send(user, receiptCrashId, receiptConfirm);
    assert.equal(careWrites, countAtCrash.careWrites);
    assert.equal(modelCalls, countAtCrash.modelCalls, "Khôi phục sau kết quả đã lưu không gọi model thêm.");
    assert.equal(receiptRecovered.activeRequest, null);
    assert.equal(receiptRecovered.conversation.filter((item) => item.role === "user" && item.content === "Xác nhận.").length, 1);
    const foreignImagesId = randomUUID();
    await assert.rejects(runtime().send(user, foreignImagesId, { requestId: randomUUID(), message: "Gửi ảnh.", customerAttachments: [image] }));
    await assert.rejects(runtime().send(user, randomUUID(), { requestId: randomUUID(), message: "Nội dung", thread_id: "gia-mao" } as never));
    // Không được cấp quyền từ một record/pendingAction do HTTP gửi thêm.
    await assert.rejects(runtime().send(user, careId, { requestId: randomUUID(), confirmation: {
      actionId: randomUUID(), decision: "CONFIRM" }, pendingAction: {} } as never));
    console.log("Đạt engine nghiệp vụ: bản xác nhận, tạo đơn/thanh toán nối tiếp, checkpoint, receipt, crash ledger, đối soát, ảnh và tool hỗ trợ thật với service giả lập.");
  } finally { mock.restoreAll(); }
}
void run().catch((error: unknown) => { mock.restoreAll(); console.error(error); process.exitCode = 1; });
