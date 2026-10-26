import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import { Types } from "mongoose";
import { Order } from "../models/order.model";
import { Provider } from "../models/provider.model";

// Cô lập collection, dịch vụ ngoài và LLM; không gửi dữ liệu hoặc thanh toán thật.
async function run() {
  require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {}, payoutPayos: {} } } as NodeModule;
  const feedback = await import("../services/feedback.service");
  const tickets = await import("../services/supportTicket.service");
  const complaints = await import("../services/complaint.service");
  const tracking = await import("../services/orderTracking.service");
  const progress = await import("../services/agentOrderProgress.service");
  const { AgentBookingService } = await import("../services/agentBooking.service");
  const { AgentFeedbackService } = await import("../services/agentFeedback.service");
  const { AgentAssignedProviderService } = await import("../services/agentAssignedProvider.service");
  const { createSupportTicketTool } = await import("../ai/tools/implementations/create-support-ticket.tool");
  const { createComplaintTool } = await import("../ai/tools/implementations/create-complaint.tool");
  const { replySupportTicketTool } = await import("../ai/tools/implementations/reply-support-ticket.tool");
  const { addComplaintEvidenceTool } = await import("../ai/tools/implementations/complaint-evidence.tool");
  const { getBookingProviderTool } = await import("../ai/tools/implementations/assigned-provider.tool");
  const { submitBookingFeedbackTool } = await import("../ai/tools/implementations/feedback.tools");
  const { ToolRegistry } = await import("../ai/tools/tool-registry");
  const { AgentService, sessionView } = await import("../ai/agent/agent.service");
  const { AgentLoop } = await import("../ai/agent/agent-loop.service");
  const { newSession } = await import("../ai/agent/agent-state");
  const { withOrderActions } = await import("../ai/agent/order-actions");
  const { agentFeedbackSchema } = await import("../services/agentFeedback.service");
  const { bookingActionSchema } = await import("../ai/agent/booking-actions");
  const { agentRequestAttachments } = await import("../ai/agent/booking-attachments");
  const id = () => new Types.ObjectId().toString();
  const user = { id: id(), role: "CUSTOMER" as const }, orderId = id(), caseId = id(), providerId = id();
  const photo = "https://res.cloudinary.com/kiem-thu/image/upload/bang-chung.png";
  const oldPhoto = "https://res.cloudinary.com/kiem-thu/image/upload/hien-trang-cu.png";
  let status = "completed", caseStatus = "open", providerExists = true, locationExists = true;
  let existing: { _id: string; rating: number; comment: string; images: string[]; updatedAt: Date } | null = null;
  let feedbackWrites = 0, careWrites = 0, lastPayload: unknown, locationCalls = 0;
  const record = () => ({ _id: caseId, orderId: { _id: orderId, orderCode: "HD-KIEM-THU" },
    title: "Khiếu nại dịch vụ", subject: "Yêu cầu hỗ trợ", description: "Nội dung yêu cầu của khách", status: caseStatus, createdAt: new Date(), responses: [] });
  mock.method(progress, "safelyTrackAgentCase", async () => {});
  mock.method(AgentBookingService, "getBooking", async (userId: string) => {
    assert.equal(userId, user.id); return { orderId, orderCode: "HD-KIEM-THU" } as never;
  });
  mock.method(feedback, "getOrderFeedbackContext", async (userId: string) => {
    if (userId !== user.id) throw Error("Không có quyền xem đơn");
    return { order: { _id: orderId, orderCode: "HD-KIEM-THU", status }, feedback: existing,
      canReview: status === "completed" && providerExists, reason: "Đơn chưa đủ điều kiện đánh giá." } as never;
  });
  mock.method(feedback, "createFeedback", async (_userId: string, payload: { rating: number; comment?: string; images?: string[] }) => {
    feedbackWrites++; lastPayload = payload;
    existing = { _id: id(), rating: payload.rating, comment: payload.comment ?? "", images: payload.images ?? [], updatedAt: new Date() };
    return existing as never;
  });
  mock.method(feedback, "updateMyFeedback", async (_userId: string, feedbackId: string, payload: { rating: number; comment: string; images: string[] }) => {
    assert.equal(feedbackId, existing?._id); feedbackWrites++; lastPayload = payload;
    existing = { ...existing!, ...payload, updatedAt: new Date() }; return existing as never;
  });
  mock.method(tickets, "createSupportTicket", async (_userId: string, role: string, payload: unknown) => {
    assert.equal(role, "CUSTOMER"); careWrites++; lastPayload = payload; return record() as never;
  });
  mock.method(tickets, "getSupportTicketForUser", async () => record() as never);
  mock.method(tickets, "addSupportTicketResponse", async (_userId: string, _role: string, _id: string, payload: unknown) => {
    careWrites++; lastPayload = payload; return record() as never;
  });
  mock.method(complaints, "getComplaintCreationContext", async () => ({ order: { orderCode: "HD-KIEM-THU" } }) as never);
  mock.method(complaints, "createComplaint", async (_userId: string, _role: string, payload: unknown) => {
    careWrites++; lastPayload = payload; return record() as never;
  });
  mock.method(complaints, "getComplaintForUser", async () => record() as never);
  mock.method(complaints, "addComplaintEvidence", async (_userId: string, _role: string, complaintId: string, payload: unknown) => {
    assert.equal(complaintId, caseId); careWrites++; lastPayload = payload; return record() as never;
  });
  const registry = new ToolRegistry().register(createSupportTicketTool).register(createComplaintTool).register(replySupportTicketTool)
    .register(addComplaintEvidenceTool).register(submitBookingFeedbackTool).register(getBookingProviderTool);
  const start = (tool: string, args: Record<string, unknown>) => {
    const session = newSession(randomUUID(), user.id);
    session.uploadedAttachments = [photo];
    session.bookingDraft = { status: "booked", revision: 3, orderId, values: { customerAttachments: [oldPhoto] }, sources: {}, missing: [], summary: [], choiceGroups: [] };
    const loop = new AgentLoop({ generate: async () => ({ type: "TOOL_CALL", tool, arguments: args }) }, registry,
      { systemPrompt: "Kiểm thử luồng", maxIterations: 2, timeoutMs: 5000 });
    const agent = new AgentService({ acquire: async () => ({ session, lockId: "khoa" }), save: async () => {}, release: async () => {} }, loop);
    const send = (message: string, customerAttachments?: string[]) => agent.send(user, session.id, { requestId: randomUUID(), message, customerAttachments });
    const decide = (decision: "CONFIRM" | "REJECT", requestId = randomUUID()) => agent.send(user, session.id,
      { requestId, confirmation: { actionId: session.pendingAction!.id, decision } });
    return { session, agent, send, decide };
  };
  for (const [tool, args, payloadKey] of [
    ["create_support_ticket", { category: "ORDER", subject: "Cần hỗ trợ đơn", description: "Dịch vụ gặp vấn đề cần hỗ trợ", orderId }, "attachments"],
    ["create_complaint", { orderId, title: "Máy bị hỏng sau vệ sinh", description: "Sau khi thợ vệ sinh máy không chạy" }, "evidenceImages"],
    ["reply_support_ticket", { ticketId: caseId, message: "Bổ sung ảnh máy gặp lỗi" }, "attachments"],
    ["add_complaint_evidence", { complaintId: caseId, note: "Ảnh bổ sung theo yêu cầu" }, "files"],
  ] as const) {
    caseStatus = "open";
    const attempt = start(tool, args), before = careWrites;
    await attempt.send("Gửi ảnh bằng chứng cho yêu cầu này", [photo]);
    assert.equal(attempt.session.pendingAction?.tool, tool);
    assert.deepEqual((attempt.session.pendingAction!.preview as { customerAttachments: string[] }).customerAttachments, [photo]);
    assert.equal(careWrites, before, "Chưa xác nhận thì không gửi hồ sơ.");
    assert.equal(attempt.session.bookingDraft?.status, "booked");
    assert.deepEqual(attempt.session.bookingDraft?.values.customerAttachments, [oldPhoto], "Không sửa ảnh đơn đã tạo.");
    const confirmation = { requestId: randomUUID(), confirmation: { actionId: attempt.session.pendingAction!.id, decision: "CONFIRM" as const } };
    await attempt.agent.send(user, attempt.session.id, confirmation);
    assert.equal(careWrites, before + 1);
    const attached = (lastPayload as Record<string, unknown[]>)[payloadKey];
    assert.deepEqual(attached, payloadKey === "evidenceImages" ? [photo] : [{ fileType: "image", url: photo }]);
    await attempt.agent.send(user, attempt.session.id, confirmation); assert.equal(careWrites, before + 1);
    const reject = start(tool, args); await reject.send("Gửi ảnh", [photo]); await reject.decide("REJECT");
    assert.equal(careWrites, before + 1, "Từ chối không ghi dữ liệu.");
    assert.equal(reject.session.pendingAction, null, "Không đề nghị lại hành động vừa bị từ chối.");
    const expired = start(tool, args); await expired.send("Gửi ảnh", [photo]);
    const expiredId = expired.session.pendingAction!.id;
    expired.session.pendingAction!.expiresAt = new Date(Date.now() - 1000).toISOString();
    await expired.decide("CONFIRM");
    assert.notEqual(expired.session.pendingAction!.id, expiredId);
    assert.deepEqual((expired.session.pendingAction!.preview as { customerAttachments: string[] }).customerAttachments, [photo]);
    assert.equal(careWrites, before + 1, "Xác nhận hết hạn không gửi ảnh cho đến khi xác nhận lại.");
    const context = { session: attempt.session, user, sessionId: attempt.session.id, signal: AbortSignal.timeout(5000) };
    await assert.rejects(async () => registry.get(tool, context).preview!(context, { ...args, customerAttachments: [oldPhoto] }), /chưa được tải lên/);
  }
  caseStatus = "resolved";
  const ambiguous = start("get_booking_provider", { orderId });
  ambiguous.session.viewedOrder = { orderId: id(), orderCode: "HD-DON-KHAC" };
  await ambiguous.send("Xem thợ thực hiện đơn này");
  assert.match(ambiguous.session.conversation[ambiguous.session.conversation.length - 1].content, /Bạn muốn xử lý đơn/);
  assert.equal(sessionView(ambiguous.session).assignedProvider, null, "Nhiều đơn mơ hồ không tự chọn thợ của đơn cũ.");
  await ambiguous.send("Đánh giá đơn này");
  assert.equal(ambiguous.session.pendingAction, null);
  const noDraftPollution = start("create_support_ticket", { category: "ORDER", subject: "Hỗ trợ đơn dịch vụ", description: "Gửi ảnh dịch vụ cần hỗ trợ", customerAttachments: [] });
  noDraftPollution.session.bookingDraft!.status = "active"; delete noDraftPollution.session.bookingDraft!.orderId;
  await noDraftPollution.send("Gửi hỗ trợ cùng ảnh vừa tải", [photo]);
  assert.deepEqual((noDraftPollution.session.pendingAction!.preview as { customerAttachments: string[] }).customerAttachments, [photo], "Ảnh khách vừa gửi không bị mất nếu model gửi danh sách rỗng.");
  assert.deepEqual(noDraftPollution.session.bookingDraft!.values.customerAttachments, [oldPhoto]);
  const evidence = start("add_complaint_evidence", { complaintId: caseId });
  const evidenceContext = { session: evidence.session, user, sessionId: evidence.session.id, signal: AbortSignal.timeout(5000) };
  await assert.rejects(() => addComplaintEvidenceTool.preview!(evidenceContext, { complaintId: caseId, customerAttachments: [photo] }), /đã kết thúc/);
  caseStatus = "open";
  await assert.rejects(() => addComplaintEvidenceTool.preview!(evidenceContext, { complaintId: caseId }), /ít nhất một ảnh/);
  assert.throws(() => agentRequestAttachments(evidence.session, Array(5).fill(photo)));
  assert.throws(() => agentRequestAttachments(evidence.session, [photo, photo]));
  assert.throws(() => agentRequestAttachments(evidence.session, ["http://khong-hop-le.vn/a.png"]));
  const ratingArgs = agentFeedbackSchema.parse({ orderId, rating: 5, comment: "Thợ làm cẩn thận" });
  for (const invalid of [0, 6, 1.5]) assert(!agentFeedbackSchema.safeParse({ orderId, rating: invalid }).success);
  assert(!agentFeedbackSchema.safeParse({ orderId }).success);
  status = "in_progress"; await assert.rejects(() => AgentFeedbackService.preview(user.id, ratingArgs), /đủ điều kiện/);
  status = "completed"; providerExists = false;
  await assert.rejects(() => AgentFeedbackService.preview(user.id, ratingArgs), /đủ điều kiện/); providerExists = true;
  await assert.rejects(() => AgentFeedbackService.get(id(), orderId), /quyền/);
  const review = start("submit_booking_feedback", ratingArgs);
  await review.send("Đánh giá 5 sao kèm ảnh", [photo]); assert.equal(feedbackWrites, 0);
  assert.equal((review.session.pendingAction!.preview as { rating: number }).rating, 5);
  await review.decide("CONFIRM"); assert.equal(feedbackWrites, 1); assert.deepEqual(existing!.images, [photo]);
  await assert.rejects(() => AgentFeedbackService.preview(user.id, ratingArgs), /đã có đánh giá/);
  const updatedArgs = agentFeedbackSchema.parse({ orderId, rating: 4, mode: "update" });
  const updated = await AgentFeedbackService.preview(user.id, updatedArgs);
  assert.deepEqual(updated.customerAttachments, [photo], "Sửa số sao không xóa ảnh cũ.");
  assert.equal(updated.description, "Thợ làm cẩn thận");
  existing!.updatedAt = new Date(Date.now() + 1000);
  await assert.rejects(() => AgentFeedbackService.submit(user.id, updatedArgs, updated), /đã thay đổi/);
  const fresh = await AgentFeedbackService.preview(user.id, updatedArgs);
  await AgentFeedbackService.submit(user.id, updatedArgs, fresh); assert.equal(feedbackWrites, 2);
  const removing = { ...updatedArgs, customerAttachments: [], comment: null };
  await AgentFeedbackService.submit(user.id, removing, await AgentFeedbackService.preview(user.id, removing));
  assert.deepEqual(existing!.images, []); assert.equal(existing!.comment, "");
  const queryChain = (value: unknown) => {
    const chain = { select: () => chain, populate: () => chain, lean: () => chain, exec: async () => value,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(value).then(resolve) }; return chain as never;
  };
  let assigned = true, providerPhone: string | undefined = "0912345678";
  mock.method(Order, "findOne", (filter: { customerId: string; _id: string }) => queryChain(filter.customerId === user.id && String(filter._id) === orderId
    ? { _id: orderId, orderCode: "HD-KIEM-THU", status, providerId: assigned ? providerId : null,
      paymentStatus: "unpaid", inspectionRequired: false, bookingStatus: "not_required" } : null));
  mock.method(Provider, "findOne", () => queryChain(providerExists ? { _id: providerId,
    userId: { fullName: "Thợ thực tế", phone: providerPhone }, averageRating: 4.8, totalCompletedOrders: 30 } : null));
  mock.method(tracking, "getOrderTrackingState", async () => {
    locationCalls++; return { provider: locationExists ? { latitude: 16.01, longitude: 108.21, updatedAt: new Date() } : null } as never;
  });
  status = "accepted";
  const actual = await AgentAssignedProviderService.get(user.id, orderId);
  assert.equal(actual.provider?.id, providerId); assert.equal(actual.provider?.phone, "0912345678"); assert(actual.location);
  providerPhone = undefined;
  const withoutPhone = await AgentAssignedProviderService.get(user.id, orderId);
  assert.equal(withoutPhone.provider?.phone, null); assert(withoutPhone.canContact, "Thiếu số điện thoại vẫn có thể nhắn tin trong đơn.");
  providerPhone = "0912345678";
  locationExists = false;
  const noLocation = await AgentAssignedProviderService.get(user.id, orderId);
  assert.equal(noLocation.location, null); assert.match(noLocation.trackingMessage, /chưa chia sẻ/);
  assigned = false; const beforeLocation = locationCalls;
  assert.equal((await AgentAssignedProviderService.get(user.id, orderId)).provider, null); assert.equal(locationCalls, beforeLocation);
  assigned = true; providerExists = false; assert.equal((await AgentAssignedProviderService.get(user.id, orderId)).canContact, false);
  providerExists = true; status = "completed";
  const completed = await AgentAssignedProviderService.get(user.id, orderId);
  assert.equal(completed.canTrack, false); assert.equal(completed.canContact, false); assert.equal(completed.provider?.phone, null);
  await assert.rejects(() => AgentAssignedProviderService.get(id(), orderId), /Không tìm thấy/);
  await assert.rejects(() => AgentAssignedProviderService.get(user.id, id()), /Không tìm thấy/);
  const direct = start("get_booking_provider", { orderId });
  await direct.agent.send(user, direct.session.id, { requestId: randomUUID(), message: "Xem thợ thực hiện", bookingAction: { type: "provider", orderId } });
  assert.equal(sessionView(direct.session).assignedProvider?.provider?.id, providerId);
  status = "in_progress";
  const actions = await withOrderActions(sessionView(direct.session), user.id);
  assert(actions.orderActions?.payment); assert.equal(actions.assignedProvider, null, "Ẩn thẻ thợ khi trạng thái đã thay đổi.");
  assert(bookingActionSchema.safeParse({ type: "feedback", feedback: ratingArgs }).success);
  assert(bookingActionSchema.safeParse({ type: "update", revision: 1, patch: { saveAddressToBook: false } }).success);
  console.log("Đạt mở rộng agent: xác nhận/từ chối/chống lặp, ảnh đúng tác vụ/đúng phiên, hồ sơ đóng, đánh giá mới/sửa/giữ ảnh/đổi phiên bản, quyền sở hữu, thợ thực tế, thiếu thợ/vị trí và thanh toán đang thực hiện.");
}
void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => mock.restoreAll());
