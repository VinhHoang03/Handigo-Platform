import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import { Types } from "mongoose";
import { newSession } from "../ai/agent/agent-state";
import { AgentLoop } from "../ai/agent/agent-loop.service";
import type { ToolContext } from "../ai/tools/tool.interface";
import type { LLMResponse } from "../ai/llm/llm.interface";
import { searchCustomerKnowledge } from "../ai/knowledge/customer-knowledge";

// Cô lập tích hợp ngoài: không nạp cấu hình thanh toán, không đọc .env, không kết nối DB/LLM.
function stubModule(path: string, exports: unknown) {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports } as NodeModule;
}
const userId = "111111111111111111111111";
const orderId = "222222222222222222222222";
const caseId = "333333333333333333333333";
stubModule("../services/agentBooking.service", { AgentBookingService: {
  getBooking: async (owner: string, id: string) => {
    assert.equal(owner, userId);
    assert.equal(id, orderId);
    return { orderId, orderCode: "HD-TEST" };
  },
} });
stubModule("../services/order.service", { OrderService: {
  previewCancellation: async (id: string, owner: string, role: string) => {
    assert.deepEqual([id, owner, role], [orderId, userId, "customer"]);
    return { canCancel: true, paidAmount: 100000, refundAmount: 70000, cancellationFee: 30000,
      policyVersion: "HANDIGO_REFUND_V1", items: [{ orderCode: "HD-TEST", refundRate: 70, policyReason: "Đã nhận đơn" }] };
  },
} });

async function main() {
  const { registerTools } = await import("../ai/tools/register-tools");
  const { AgentCustomerCareService: care, customerCaseView } = await import("../services/agentCustomerCare.service");
  const { AgentService } = await import("../ai/agent/agent.service");
  const { SupportTicket } = await import("../models/supportTicket.model");
  const { Complaint } = await import("../models/complaint.model");
  const { Order } = await import("../models/order.model");
  const { OrderStatus } = await import("../models/orderStatus.model");
  const { Provider } = await import("../models/provider.model");
  const complaints = await import("../services/complaint.service");
  const tickets = await import("../services/supportTicket.service");
  const context: ToolContext = { user: { id: userId, role: "CUSTOMER" }, sessionId: randomUUID(), signal: new AbortController().signal };
  const registry = registerTools({});
  assert.equal(registry.list(context).length, 24);
  for (const name of ["create_booking", "cancel_booking", "create_payment", "get_payment_status", "get_service_catalog"]) {
    assert.ok(registry.get(name, context));
  }
  assert.equal(registry.list({ ...context, user: { id: userId, role: "PROVIDER" } }).length, 0);
  assert.equal(registry.list({ ...context, user: { id: userId, role: "ADMIN" } }).length, 0);
  const disabled = registerTools({ create_support_ticket: { enabled: false } });
  assert.throws(() => disabled.get("create_support_ticket", context));
  const required = registerTools({ create_support_ticket: { requiresConfirmation: false } });
  assert.equal(required.needsConfirmation(required.get("create_support_ticket", context)), true);

  const ticketArgs = { subject: "Không mở được trang đơn", description: "Trang đơn của tôi tải mãi không xong.", category: "TECHNICAL" };
  const createTool = registry.get("create_support_ticket", context);
  assert.throws(() => createTool.inputSchema.parse({ ...ticketArgs, userId: "người khác" }));
  assert.throws(() => createTool.inputSchema.parse({ ...ticketArgs, attachments: [{ url: "https://example.com" }] }));
  assert.throws(() => createTool.inputSchema.parse({ ...ticketArgs, description: "ngắn" }));
  assert.throws(() => registry.get("create_complaint", context).inputSchema.parse({ orderId, title: "Khiếu nại", description: "Dịch vụ chưa đạt yêu cầu", evidenceImages: ["https://example.com"] }));

  const document = { _id: new Types.ObjectId(caseId), status: "open", subject: ticketArgs.subject,
    description: ticketArgs.description, category: "TECHNICAL", priority: "MEDIUM", createdAt: new Date(),
    orderId: { _id: new Types.ObjectId(orderId), orderCode: "HD-TEST", customerId: "riêng tư" },
    assignedAdminId: { fullName: "Quản trị", email: "riêng tư" }, requesterId: { email: "riêng tư" },
    responses: [{ responderRole: "ADMIN", message: "Đã tiếp nhận", respondedAt: new Date(), responderId: { email: "riêng tư" } }],
  };
  assert.ok(!JSON.stringify(customerCaseView(document, true)).includes("riêng tư"));
  const ticketRead = mock.method(SupportTicket, "findOne", (filter: unknown) => {
    assert.deepEqual(filter, { _id: caseId, requesterId: userId, isDeleted: false });
    return { populate: async () => document };
  });
  const detail = await care.ticket(userId, caseId);
  assert.equal(detail.responses[0].message, "Đã tiếp nhận");
  assert.ok(!JSON.stringify(detail).includes("riêng tư"));
  assert.deepEqual((await care.ticket(userId, caseId, 2)).responses, []);
  ticketRead.mock.restore();
  const createTicketMock = mock.method(tickets, "createSupportTicket", async (owner: string, role: string, payload: unknown) => {
    assert.deepEqual([owner, role, payload], [userId, "CUSTOMER", ticketArgs]);
    return document;
  });
  const created = await care.createTicket(userId, createTool.inputSchema.parse(ticketArgs) as Parameters<typeof care.createTicket>[1]);
  assert.equal(created.id, caseId);
  assert.ok(!JSON.stringify(created).includes("riêng tư"));
  createTicketMock.mock.restore();

  // Kiểm tra điều kiện thật của service khiếu nại bằng dữ liệu giả lập.
  const order = { _id: new Types.ObjectId(orderId), customerId: new Types.ObjectId(userId), providerId: new Types.ObjectId(caseId),
    status: "completed", updatedAt: new Date(), orderCode: "HD-TEST" };
  let completedAt = new Date();
  let existingComplaint = false;
  const orderMock = mock.method(Order, "findOne", async () => order);
  const providerMock = mock.method(Provider, "findOne", () => ({ select: async () => ({ userId: new Types.ObjectId(caseId) }) }));
  const statusMock = mock.method(OrderStatus, "findOne", () => ({ sort: () => ({ select: () => ({ lean: async () => ({ createdAt: completedAt }) }) }) }));
  const complaintMock = mock.method(Complaint, "findOne", async () => existingComplaint ? { _id: caseId } : null);
  await complaints.getComplaintCreationContext(userId, "CUSTOMER", orderId);
  await assert.rejects(complaints.getComplaintCreationContext(caseId, "CUSTOMER", orderId));
  order.status = "accepted";
  await assert.rejects(complaints.getComplaintCreationContext(userId, "CUSTOMER", orderId), /đã hoàn thành/);
  order.status = "completed";
  completedAt = new Date(Date.now() - 4 * 86400000);
  await assert.rejects(complaints.getComplaintCreationContext(userId, "CUSTOMER", orderId), /3 ngày/);
  completedAt = new Date();
  existingComplaint = true;
  await assert.rejects(complaints.getComplaintCreationContext(userId, "CUSTOMER", orderId), /đã tạo khiếu nại/);
  for (const item of [orderMock, providerMock, statusMock, complaintMock]) item.mock.restore();

  let writes = 0;
  const writeMock = mock.method(care, "createTicket", async (owner: string) => {
    assert.equal(owner, userId);
    writes += 1;
    return customerCaseView(document);
  });
  function scenario() {
    const session = newSession(randomUUID(), userId);
    const replies: LLMResponse[] = [{ type: "TOOL_CALL", tool: "create_support_ticket", arguments: ticketArgs }, { type: "FINAL", message: "Đã dừng theo yêu cầu." }];
    const loop = new AgentLoop({ generate: async () => replies.shift()! }, registry, { maxIterations: 4, timeoutMs: 1000, systemPrompt: "Kiểm thử" });
    const service = new AgentService({ acquire: async () => ({ session, lockId: "test" }), save: async () => {}, release: async () => {} }, loop);
    return { session, service };
  }
  const first = scenario();
  await first.service.send(context.user, first.session.id, { requestId: randomUUID(), message: "Gửi hỗ trợ giúp tôi" });
  assert.equal(first.session.state, "WAITING_CONFIRMATION");
  assert.equal(writes, 0);
  assert.equal((first.session.pendingAction!.preview as { description: string }).description, ticketArgs.description);
  const confirmation = { requestId: randomUUID(), confirmation: { actionId: first.session.pendingAction!.id, decision: "CONFIRM" as const } };
  await first.service.send(context.user, first.session.id, confirmation);
  assert.equal(writes, 1);
  assert.equal(first.session.state, "COMPLETED");
  await first.service.send(context.user, first.session.id, confirmation);
  assert.equal(writes, 1);
  await assert.rejects(first.service.send(context.user, first.session.id, { ...confirmation, requestId: randomUUID() }));
  assert.equal(writes, 1);

  const rejected = scenario();
  await rejected.service.send(context.user, rejected.session.id, { requestId: randomUUID(), message: "Gửi hỗ trợ" });
  await rejected.service.send(context.user, rejected.session.id, { requestId: randomUUID(), confirmation: { actionId: rejected.session.pendingAction!.id, decision: "REJECT" } });
  assert.equal(writes, 1);
  assert.equal(rejected.session.actions[0].status, "REJECTED");

  const expired = scenario();
  await expired.service.send(context.user, expired.session.id, { requestId: randomUUID(), message: "Gửi hỗ trợ" });
  expired.session.pendingAction!.expiresAt = new Date(Date.now() - 1000).toISOString();
  await expired.service.send(context.user, expired.session.id, { requestId: randomUUID(), confirmation: { actionId: expired.session.pendingAction!.id, decision: "CONFIRM" } });
  assert.equal(expired.session.actions[0].status, "EXPIRED");
  assert.equal(writes, 1);

  const changed = scenario();
  await changed.service.send(context.user, changed.session.id, { requestId: randomUUID(), message: "Gửi hỗ trợ" });
  const originalActionId = changed.session.pendingAction!.id;
  const previewMock = mock.method(care, "previewTicket", async () => ({ title: "Nội dung đã thay đổi", description: "Cần kiểm tra lại" }));
  await changed.service.send(context.user, changed.session.id, { requestId: randomUUID(), confirmation: { actionId: originalActionId, decision: "CONFIRM" } });
  assert.equal(changed.session.state, "WAITING_CONFIRMATION");
  assert.notEqual(changed.session.pendingAction!.id, originalActionId);
  assert.equal(writes, 1);
  previewMock.mock.restore();
  writeMock.mock.restore();

  const failureMock = mock.method(care, "createTicket", async () => { throw new Error("Mất kết nối sau khi ghi"); });
  const uncertain = scenario();
  await uncertain.service.send(context.user, uncertain.session.id, { requestId: randomUUID(), message: "Gửi hỗ trợ" });
  await uncertain.service.send(context.user, uncertain.session.id, { requestId: randomUUID(), confirmation: { actionId: uncertain.session.pendingAction!.id, decision: "CONFIRM" } });
  assert.equal(uncertain.session.requiresReconciliation, true);
  await uncertain.service.send(context.user, uncertain.session.id, { requestId: randomUUID(), message: "Gửi lại" });
  assert.equal(failureMock.mock.callCount(), 1);
  failureMock.mock.restore();

  assert.equal(searchCustomerKnowledge("khieu nai").articles[0].topic, "complaint");
  assert.equal(searchCustomerKnowledge("không rõ", "payment").articles[0].topic, "payment");
  assert.equal(searchCustomerKnowledge("xyz123").articles.length, 0);
  assert.match(searchCustomerKnowledge("mật khẩu", "account").articles[0].content, /OTP/);
  const previewTool = registry.get("get_cancellation_preview", context);
  assert.equal(registry.needsConfirmation(previewTool), false);
  const preview = await previewTool.execute(context, { orderId }) as { refundAmount: number; refundRate: number };
  assert.equal(preview.refundAmount, 70000);
  assert.equal(preview.refundRate, 70);
  console.log("Đã kiểm tra quyền, dữ liệu riêng tư, điều kiện khiếu nại, xác nhận, chống gửi lặp, lỗi ghi và tra cứu kiến thức của trợ lý customer.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => mock.restoreAll());
