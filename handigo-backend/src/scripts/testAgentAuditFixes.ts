import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import mongoose, { Types } from "mongoose";
import { z } from "zod";
import { AgentService, sessionView } from "../ai/agent/agent.service";
import { AgentLoop } from "../ai/agent/agent-loop.service";
import { newSession } from "../ai/agent/agent-state";
import { ToolRegistry } from "../ai/tools/tool-registry";
import { updateBookingDraft } from "../ai/agent/booking-draft";
import { withOrderActions } from "../ai/agent/order-actions";
import { Order } from "../models/order.model";
import { Feedback } from "../models/feedback.model";
import { Provider } from "../models/provider.model";
import { AppError } from "../utils/appError";
import { agentActionResourceId } from "../utils/agentActionResourceId";

// Giữ logic agent/service thật, chỉ giả lập nguồn dữ liệu; không tạo đơn hoặc giao dịch thật.
async function run() {
  require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {}, payoutPayos: {} } } as NodeModule;
  const tickets = await import("../services/supportTicket.service");
  const complaints = await import("../services/complaint.service");
  const feedback = await import("../services/feedback.service");
  const progress = await import("../services/agentOrderProgress.service");
  const { AgentCustomerCareService: care } = await import("../services/agentCustomerCare.service");
  const { AgentFeedbackService } = await import("../services/agentFeedback.service");
  const { createSupportTicketTool } = await import("../ai/tools/implementations/create-support-ticket.tool");
  const { createComplaintTool } = await import("../ai/tools/implementations/create-complaint.tool");
  const { getSupportTicketTool } = await import("../ai/tools/implementations/get-support-ticket.tool");
  const { submitBookingFeedbackTool } = await import("../ai/tools/implementations/feedback.tools");
  const id = () => new Types.ObjectId().toString();
  const user = { id: id(), role: "CUSTOMER" as const }, orderId = id(), caseId = id(), providerId = id();
  const photo = "https://res.cloudinary.com/kiem-thu/image/upload/bang-chung.png";
  const deps = { search: async () => [], service: async () => ({ id: id(), name: "Vệ sinh điều hòa", serviceType: "fixed_price",
    requiresOptionSelection: false, fixedPrice: 200000, options: [] }), addresses: async () => [] };
  const now = Date.now();
  for (const scheduledAt of [new Date(now - 30000).toISOString(), new Date(now - 86400000).toISOString()]) {
    const draft = await updateBookingDraft(undefined, { mode: "update", scheduledAt, quantity: 2 }, user.id, deps);
    assert.equal(draft.values.scheduledAt, undefined, "Không tự chuyển ngày/giữ giờ đã qua, kể cả cùng phút.");
    assert(draft.missing.some((line) => line.includes("ngày và giờ hẹn")));
    assert.equal(draft.scheduleDate, new Date(Date.parse(scheduledAt) + 7 * 3600000).toISOString().slice(0, 10));
  }
  const futureDay = new Date(now + 7 * 86400000).toISOString().slice(0, 10);
  const future = await updateBookingDraft(undefined, { mode: "update", scheduledAt: `${futureDay}T09:00:00+07:00` }, user.id, deps);
  assert.equal(future.values.scheduledAt, `${futureDay}T09:00:00+07:00`);
  const immediate = await updateBookingDraft(future, { mode: "update", orderType: "normal" }, user.id, deps);
  assert.equal(immediate.values.scheduledAt, undefined);

  const assignedProvider = { orderId, orderCode: "HD-KIỂM-THỬ", status: "accepted", checkedAt: new Date().toISOString(),
    provider: { id: providerId, name: "Thợ thực tế", phone: "0912345678", averageRating: 5, totalCompletedOrders: 10 },
    canContact: true, canTrack: true, location: null, trackingMessage: "Chưa có vị trí", path: "/customer/bookings", message: "Thợ đã nhận đơn" };
  const baseView = { ...sessionView(newSession(randomUUID(), user.id)), assignedProvider, viewedOrder: { orderId, orderCode: "HD-KIỂM-THỬ" } };
  let orderRead: unknown = null, orderError = false;
  const chain = { select: () => chain, lean: () => chain, exec: async () => {
    if (orderError) throw Error("Nguồn đơn tạm lỗi"); return orderRead;
  } };
  mock.method(Order, "findOne", () => chain as never);
  assert.equal((await withOrderActions(baseView, user.id)).assignedProvider, null);
  orderError = true; assert.equal((await withOrderActions(baseView, user.id)).assignedProvider, null); orderError = false;
  orderRead = { _id: orderId, orderCode: "HD-KIỂM-THỬ", status: "accepted", providerId, paymentStatus: "unpaid" };
  assert.equal((await withOrderActions(baseView, user.id)).assignedProvider, assignedProvider);
  orderRead = { ...(orderRead as object), providerId: id() };
  assert.equal((await withOrderActions(baseView, user.id)).assignedProvider, null);

  mock.method(progress, "safelyTrackAgentCase", async () => {});
  const record = (_id: unknown = caseId) => ({ _id, orderId: { _id: orderId, orderCode: "HD-KIỂM-THỬ" },
    subject: "Cần hỗ trợ", title: "Dịch vụ gặp vấn đề", description: "Nội dung do khách cung cấp", category: "ORDER", priority: "MEDIUM",
    status: "open", createdAt: new Date(), responses: [] });
  let writes = 0, savedId = "", found = false, sourceError = false, reads = 0;
  mock.method(tickets, "createSupportTicket", async (_user: string, _role: unknown, _payload: unknown, resourceId?: Types.ObjectId) => {
    writes++; savedId = String(resourceId); throw Error("Mất kết quả sau ghi");
  });
  mock.method(tickets, "getSupportTicketForUser", async (owner: string, target: string) => {
    reads++;
    if (sourceError) throw Error("Nguồn hỗ trợ tạm lỗi");
    if (owner !== user.id || target !== caseId && !(found && target === savedId)) throw new AppError("Không tìm thấy yêu cầu hỗ trợ", 404);
    return record(target) as never;
  });
  const registry = new ToolRegistry().register(createSupportTicketTool).register(createComplaintTool)
    .register(getSupportTicketTool).register(submitBookingFeedbackTool)
    .register({ name: "update_booking_draft", description: "Kiểm thử chặn sửa nháp", inputSchema: z.object({}), roles: ["CUSTOMER"],
      mutates: false, requiresConfirmation: false, execute: async () => { throw Error("Không được gọi"); } });
  const session = newSession(randomUUID(), user.id);
  const input = { category: "TECHNICAL", subject: "Cần hỗ trợ", description: "Tôi cần hỗ trợ giao diện" };
  const loop = new AgentLoop({ generate: async (request) => {
    if (session.requiresReconciliation) {
      if (request.goal.includes("gửi lại")) return { type: "TOOL_CALL", tool: "create_support_ticket", arguments: input };
      if (request.conversation[request.conversation.length - 1]?.tool === "get_support_ticket") return { type: "FINAL", message: "Đã tra cứu hồ sơ." };
      return { type: "TOOL_CALL", tool: "get_support_ticket", arguments: { ticketId: caseId } };
    }
    return { type: "TOOL_CALL", tool: "create_support_ticket", arguments: input };
  } }, registry, { systemPrompt: "Kiểm thử", maxIterations: 3, timeoutMs: 5000 });
  const agent = new AgentService({ acquire: async () => ({ session, lockId: "khóa" }), save: async () => {}, release: async () => {} }, loop);
  await agent.send(user, session.id, { requestId: randomUUID(), message: "Gửi yêu cầu hỗ trợ" });
  const actionId = session.pendingAction!.id;
  await agent.send(user, session.id, { requestId: randomUUID(), confirmation: { actionId, decision: "CONFIRM" } });
  assert.equal(session.requiresReconciliation, true);
  assert.equal(savedId, String(agentActionResourceId(user.id, session.id, actionId)));
  const readRequest = { requestId: randomUUID(), message: "Tra cứu hỗ trợ của tôi" };
  await agent.send(user, session.id, readRequest);
  assert(session.conversation.some((message) => message.role === "tool" && message.tool === "get_support_ticket"));
  assert.equal(session.requiresReconciliation, true, "Chưa có bằng chứng thì chưa mở khóa ghi.");
  const previousReads = reads;
  await agent.send(user, session.id, readRequest); assert.equal(reads, previousReads, "Gửi lặp request tra cứu không chạy lại.");
  await agent.send(user, session.id, { requestId: randomUUID(), message: "gửi lại yêu cầu" });
  assert.equal(writes, 1, "Model không thể ghi lặp trong chế độ chỉ tra cứu.");
  const readContext = { user, sessionId: session.id, signal: AbortSignal.timeout(5000), readOnly: true };
  assert.throws(() => registry.get("update_booking_draft", readContext), /chưa thể ghi/);
  assert.throws(() => registry.get("submit_booking_feedback", readContext), /chưa thể ghi/);
  assert.equal(registry.list(readContext).some((tool) => tool.name === "create_support_ticket"), false);
  sourceError = true;
  await agent.send(user, session.id, { requestId: randomUUID(), message: "Kiểm tra kết quả" });
  assert.equal(session.requiresReconciliation, true); sourceError = false; found = true;
  const recoveryRequest = { requestId: randomUUID(), message: "Kiểm tra kết quả" };
  await agent.send(user, session.id, recoveryRequest);
  assert.equal(session.requiresReconciliation, false);
  assert.equal(session.actions.find((action) => action.id === actionId)?.status, "SUCCEEDED");
  await agent.send(user, session.id, recoveryRequest); assert.equal(writes, 1);
  assert.equal(await care.reconcileCreated(id(), session.id, actionId, "ticket"), null, "Không đối soát hồ sơ của tài khoản khác.");

  let complaintId = "";
  mock.method(complaints, "createComplaint", async (_user: string, _role: unknown, _payload: unknown, resourceId?: Types.ObjectId) => { complaintId = String(resourceId); return record(resourceId) as never; });
  mock.method(complaints, "getComplaintForUser", async (_owner: string, target: string) => record(target) as never);
  await care.createComplaint(user.id, { orderId, title: "Dịch vụ gặp vấn đề", description: "Nội dung khách cung cấp" }, session.id, actionId);
  assert.equal(complaintId, savedId);
  assert.equal((await care.reconcileCreated(user.id, session.id, actionId, "complaint"))?.id, complaintId);
  const started = new Date(Date.now() - 1000).toISOString();
  mock.method(tickets, "getSupportTicketForUser", async () => ({ ...record(), responses: [{ responderId: user.id, responderRole: "USER",
    message: "Bổ sung thông tin", attachments: [{ url: photo }], respondedAt: new Date() }] }) as never);
  assert(await care.reconcileResponse(user.id, caseId, "Bổ sung thông tin", [photo], started));
  assert.equal(await care.reconcileResponse(user.id, caseId, "Nội dung khác", [photo], started), null);
  assert.equal(await care.reconcileResponse(user.id, caseId, "Bổ sung thông tin", [photo], new Date(Date.now() + 10000).toISOString()), null);
  mock.method(tickets, "getSupportTicketForUser", async () => ({ ...record(), status: "cancelled" }) as never);
  assert(await care.reconcileCancellation(user.id, caseId, "ticket"));
  mock.method(complaints, "getComplaintForUser", async () => ({ ...record(), status: "cancelled", evidence: [{ uploadedBy: { _id: user.id },
    url: photo, fileType: "image", note: "Ảnh bổ sung", createdAt: new Date() }] }) as never);
  assert(await care.reconcileCancellation(user.id, caseId, "complaint"));
  assert(await care.reconcileEvidence(user.id, caseId, [photo], "Ảnh bổ sung", started));
  assert.equal(await care.reconcileEvidence(user.id, caseId, [photo, `${photo}?khac`], "Ảnh bổ sung", started), null, "Thiếu một ảnh không coi là đã gửi đủ.");

  const feedbackId = String(agentActionResourceId(user.id, session.id, randomUUID()));
  let current = { _id: feedbackId, rating: 4, comment: "Nhận xét cũ", images: [photo], updatedAt: new Date(Date.now() - 10000), providerId };
  let feedbackExists = true;
  mock.method(feedback, "getOrderFeedbackContext", async () => ({ order: { _id: orderId, orderCode: "HD-KIỂM-THỬ" }, feedback: feedbackExists ? current : null, canReview: true }) as never);
  mock.method(mongoose, "startSession", async () => ({ withTransaction: async (work: (session: unknown) => Promise<unknown>) => work({}),
    endSession: async () => {} }) as never);
  mock.method(Provider, "findOneAndUpdate", async () => ({ _id: providerId }) as never);
  mock.method(Order, "find", () => ({ session: () => ({ distinct: async () => [orderId] }) }) as never);
  mock.method(Feedback, "aggregate", () => ({ session: async () => [] }) as never);
  mock.method(Provider, "findByIdAndUpdate", async () => null as never);
  let race = false, updates = 0, lastChanges: Record<string, unknown> = {};
  mock.method(Feedback, "findOneAndUpdate", (filter: { customerId: string; updatedAt: Date }, update: { $set: Record<string, unknown> }, options: { runValidators: boolean }) => {
    assert.equal(filter.customerId, user.id); assert(options.runValidators);
    if (race) current = { ...current, comment: "Nhận xét vừa sửa ở màn hình đơn", updatedAt: new Date() };
    if (filter.updatedAt.getTime() !== current.updatedAt.getTime()) return Promise.resolve(null) as never;
    updates++; lastChanges = update.$set; current = { ...current, ...update.$set, updatedAt: new Date() };
    return Promise.resolve(current) as never;
  });
  const args = { orderId, mode: "update" as const, rating: 5 };
  const preview = await AgentFeedbackService.preview(user.id, args);
  race = true;
  await assert.rejects(() => AgentFeedbackService.submit(user.id, args, preview), /đã thay đổi/);
  assert.equal(current.comment, "Nhận xét vừa sửa ở màn hình đơn"); assert.equal(updates, 0);
  race = false;
  await AgentFeedbackService.submit(user.id, args, await AgentFeedbackService.preview(user.id, args));
  assert.deepEqual(lastChanges, { rating: 5 }, "Chỉ đổi sao thì không ghi lại ảnh và nhận xét cũ.");
  assert.equal(current.comment, "Nhận xét vừa sửa ở màn hình đơn"); assert.deepEqual(current.images, [photo]);
  const clearing = { ...args, comment: null, customerAttachments: [] };
  await AgentFeedbackService.submit(user.id, clearing, await AgentFeedbackService.preview(user.id, clearing));
  assert.equal(current.comment, ""); assert.deepEqual(current.images, []);
  const expected = await AgentFeedbackService.preview(user.id, clearing);
  assert(await AgentFeedbackService.reconcile(user.id, clearing, expected, session.id, actionId, started));
  assert.equal(await AgentFeedbackService.reconcile(user.id, { ...clearing, mode: "create" }, expected, session.id, actionId, started), null);
  feedbackExists = false;
  const creating = { orderId, mode: "create" as const, rating: 4, comment: "Thợ làm cẩn thận", customerAttachments: [photo] };
  const creatingPreview = await AgentFeedbackService.preview(user.id, creating);
  mock.method(feedback, "createFeedback", async (_owner: string, payload: { rating: number; comment?: string | null; images?: string[] }, resourceId?: Types.ObjectId) => {
    current = { ...current, _id: String(resourceId), rating: payload.rating, comment: payload.comment ?? "", images: payload.images ?? [], updatedAt: new Date() };
    feedbackExists = true; return current as never;
  });
  await AgentFeedbackService.submit(user.id, creating, creatingPreview, session.id, actionId);
  assert.equal(current._id, String(agentActionResourceId(user.id, session.id, actionId)));
  assert(await AgentFeedbackService.reconcile(user.id, creating, creatingPreview, session.id, actionId, started));
  console.log("Đạt sửa lỗi rà soát: lịch đã qua không tự đổi ngày, ẩn thợ cũ khi lỗi/mất đơn, đối soát hỗ trợ/khiếu nại/đánh giá, tra cứu khi UNKNOWN không ghi lặp và cập nhật đánh giá theo phiên bản.");
}
void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => mock.restoreAll());
