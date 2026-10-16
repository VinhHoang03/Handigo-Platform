import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import { Types } from "mongoose";
import { AgentLoop } from "../ai/agent/agent-loop.service";
import { newSession, type AgentInput } from "../ai/agent/agent-state";
import { updateBookingDraft, type BookingDraftDependencies } from "../ai/agent/booking-draft";
import { CONTINUE_REQUEST, type BookingAction } from "../ai/agent/booking-actions";
import { ToolRegistry } from "../ai/tools/tool-registry";
import { bookingSchema } from "../ai/tools/implementations/booking.schemas";
import { createUpdateBookingDraftTool } from "../ai/tools/implementations/update-booking-draft.tool";
import { Order } from "../models/order.model";

// Kiểm chứng công cụ thật và vòng điều phối; không ghi database, không gọi AI/cổng thanh toán thật.
async function run() {
  require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {}, payoutPayos: {} } } as NodeModule;
  const { AgentService, sessionView } = await import("../ai/agent/agent.service");
  const { withOrderActions } = await import("../ai/agent/order-actions");
  const { AgentBookingService } = await import("../services/agentBooking.service");
  const { AgentBookingHistoryService } = await import("../services/agentBookingHistory.service");
  const { AgentQuotationService } = await import("../services/agentQuotation.service");
  const { rebookBookingTool, searchMyBookingsTool, getBookingRefundsTool } = await import("../ai/tools/implementations/booking-history.tools");
  const { getBookingQuotationTool } = await import("../ai/tools/implementations/quotation.tools");
  const user = { id: new Types.ObjectId().toString(), role: "CUSTOMER" as const };
  const id = () => new Types.ObjectId().toString();
  const serviceId = id(), addressId = id(), otherAddress = id(), providerId = id(), otherProvider = id(), orderId = id();
  let modelCalls = 0, writes = 0, quoteCalls = 0, failQuote = false, failProviders = false;
  let policyVersion = "a".repeat(64);
  const addresses = [{ id: addressId, fullAddress: "12 Lê Lợi", ward: "Phường A", province: "Đà Nẵng", isDefault: true },
    { id: otherAddress, fullAddress: "34 Nguyễn Trãi", ward: "Phường B", province: "Đà Nẵng", isDefault: false }];
  const deps: BookingDraftDependencies = {
    search: async () => [],
    service: async () => ({ id: serviceId, name: "Vệ sinh điều hòa", fixedPrice: 200000, serviceType: "fixed_price", requiresOptionSelection: false, options: [] }),
    addresses: async () => addresses,
    vouchers: async () => [],
    providers: async (_user, args) => {
      if (failProviders) throw Error("Lỗi nguồn thợ giả lập");
      return { available: [{ id: providerId, name: "Nguyễn Minh" }, { id: otherProvider, name: "Nguyễn Minh" }],
        requested: args.preferredProviderId ? [{ id: args.preferredProviderId, name: "Nguyễn Minh", eligible: true, reason: "Phù hợp" }] : [] };
    },
  };
  let session = newSession(randomUUID(), user.id);
  const registry = new ToolRegistry().register(createUpdateBookingDraftTool(deps)).register(rebookBookingTool)
    .register(searchMyBookingsTool).register(getBookingQuotationTool).register(getBookingRefundsTool).register({
      name: "create_booking", description: "Đơn kiểm thử", roles: ["CUSTOMER"], inputSchema: bookingSchema, mutates: true, requiresConfirmation: true,
      preview: async (_context, args) => ({ title: "Tạo đơn", amount: 200000 * (args.uniformQuantity ?? 1), policyVersion }),
      execute: async () => { writes++; return { orderId, orderCode: "HD-MOI", paymentMethod: "bank", orderType: "normal", bookingStatus: "not_required" }; },
    });
  const loop = new AgentLoop({ generate: async () => { modelCalls++; throw new SyntaxError("Phản hồi AI sai định dạng giả lập"); } }, registry,
    { maxIterations: 2, timeoutMs: 2000, systemPrompt: "Kiểm thử" });
  const agent = new AgentService({ acquire: async () => ({ session, lockId: "khoa" }), save: async () => {}, release: async () => {} }, loop);
  let lastInput: AgentInput;
  const send = (message: string, bookingAction?: BookingAction) => {
    lastInput = { requestId: randomUUID(), message, bookingAction };
    return agent.send(user, session.id, lastInput);
  };
  const change = (patch: Extract<BookingAction, { type: "update" }>["patch"]) => send("Thay đổi theo lựa chọn trên giao diện.", { type: "update", revision: session.bookingDraft!.revision, patch });
  try {
    session.bookingDraft = await updateBookingDraft(undefined, { mode: "update", serviceId }, user.id, deps);
    await change({ quantity: 3 });
    assert.equal(session.bookingDraft.values.uniformQuantity, 3);
    const completedDraftInput = lastInput!;
    const completedRevision = session.bookingDraft.revision;
    session.receipts = session.receipts.filter((r) => r.requestId !== completedDraftInput.requestId);
    session.activeRequest = { requestId: completedDraftInput.requestId, digest: (await import("node:crypto")).createHash("sha256").update(JSON.stringify(completedDraftInput)).digest("hex"), input: completedDraftInput };
    session.pendingAction = null;
    await agent.send(user, session.id, completedDraftInput);
    assert.equal(session.bookingDraft.revision, completedRevision, "Lượt gián đoạn sau checkpoint tiếp tục chuẩn bị xác nhận, không sửa bản nháp lần hai.");
    const oldAction = session.pendingAction!.id;
    await change({ addressId: otherAddress });
    assert.equal(session.bookingDraft.values.addressId, otherAddress);
    assert.notEqual(session.pendingAction!.id, oldAction);
    await change({ paymentMethod: "wallet" });
    assert.equal(session.bookingDraft.values.paymentMethod, "wallet");
    const day = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    await change({ orderType: "scheduled", scheduledAt: `${day}T09:30:00+07:00` });
    assert.equal(Date.parse(session.bookingDraft.values.scheduledAt!), Date.parse(`${day}T09:30:00+07:00`));
    await change({ preferredProviderId: otherProvider });
    assert.equal(session.bookingDraft.values.preferredProviderId, otherProvider, "Thợ trùng tên vẫn giữ đúng ID từ dữ liệu lựa chọn.");
    const current = structuredClone(session.bookingDraft);
    await send("Gửi lựa chọn từ tab cũ.", { type: "update", revision: 0, patch: { quantity: 9 } });
    assert.deepEqual(session.bookingDraft, current, "Không nhận sửa từ phiên bản bản nháp cũ.");
    await change({ orderType: "normal", scheduledAt: null });
    assert.equal(session.bookingDraft.values.scheduledAt, undefined);
    await change({ mode: "pause" });
    assert.equal(session.bookingDraft.status, "paused");
    await change({ mode: "resume" });
    assert.equal(session.bookingDraft.status, "active");
    assert.equal(modelCalls, 0);
    assert.equal(writes, 0);

    const confirm = (consent?: { accepted: true; version: string }) => agent.send(user, session.id, {
      requestId: randomUUID(), confirmation: { actionId: session.pendingAction!.id, decision: "CONFIRM", ...(consent ? { policyConsent: consent } : {}) },
    });
    await confirm();
    assert.equal(writes, 0, "Không bỏ qua chính sách bằng request thiếu đồng ý.");
    await confirm({ accepted: true, version: "c".repeat(64) });
    assert.equal(writes, 0, "Không nhận phiên bản khác bản xác nhận.");
    const priorAction = session.pendingAction!.id;
    policyVersion = "b".repeat(64);
    await confirm({ accepted: true, version: "a".repeat(64) });
    assert.notEqual(session.pendingAction!.id, priorAction, "Chính sách thay đổi phải tạo bản mới.");
    assert.equal(writes, 0);
    const acceptedAction = session.pendingAction!.id;
    const confirmation: AgentInput = { requestId: randomUUID(), confirmation: { actionId: acceptedAction, decision: "CONFIRM", policyConsent: { accepted: true, version: policyVersion } } };
    await agent.send(user, session.id, confirmation);
    await agent.send(user, session.id, confirmation);
    assert.equal(writes, 1);
    const evidence = session.actions.find((a) => a.id === acceptedAction)!.policyConsent;
    assert.equal(evidence?.version, policyVersion); assert.equal(evidence?.actionId, acceptedAction);
    assert(Number.isFinite(Date.parse(evidence!.acceptedAt)));

    session = newSession(randomUUID(), user.id);
    session.bookingDraft = await updateBookingDraft(undefined, { mode: "update", serviceId, quantity: 4, paymentMethod: "wallet" }, user.id, deps);
    session.bookingDraft.values.problemDescription = "Giữ ghi chú của khách";
    const temporaryId = id();
    session.bookingDraft.draftAddress = { id: temporaryId, userId: user.id, preparedAt: new Date().toISOString(),
      payload: { fullAddress: "Đại học FPT", province: "Đà Nẵng", ward: "Ngũ Hành Sơn", recipientName: "Khách kiểm thử", recipientPhone: "0912345678", isDefault: false } };
    session.bookingDraft.values.addressId = temporaryId;
    session.uploadedAttachments = ["https://example.com/anh-kiem-thu.png"];
    session.bookingDraft.values.customerAttachments = [...session.uploadedAttachments];
    const beforeRebook = structuredClone(session.bookingDraft);
    const historicalOrder = { _id: orderId, orderCode: "HD-CU", status: "completed", serviceId, addressId, providerId,
      selectedOptionsSnapshot: [{ optionId: null, name: "Giá chung", quantity: 2 }], addressSnapshot: addresses[0], paymentMethod: "bank" };
    mock.method(Order, "findOne", () => ({ lean: async () => historicalOrder }) as never);
    mock.method(AgentBookingService, "service", deps.service);
    mock.method(AgentBookingService, "addresses", deps.addresses);
    mock.method(AgentBookingService, "vouchers", async () => []);
    mock.method(AgentBookingService, "providers", deps.providers!);
    mock.method(AgentBookingHistoryService, "search", async () => ({ items: [{ orderId, orderCode: "HD-CU", status: "completed",
      serviceId, service: "Vệ sinh điều hòa", providerId, provider: "Nguyễn Minh", serviceType: "fixed_price", hasQuotation: false,
      address: null, createdAt: new Date(), paymentStatus: "paid", options: [] }], pagination: { page: 1, limit: 5, total: 1, totalPages: 1 } }) as never);
    await send("Tôi muốn tìm đơn cũ. Hãy cho tôi chọn đơn theo dịch vụ, địa chỉ, thời gian hoặc mã đơn; có thể xem thêm trang nếu cần.");
    const rebook = `Đặt lại cùng thợ cũ đơn ${orderId} (HD-CU) từ kết quả tìm đơn cũ.`;
    await send(rebook);
    assert.deepEqual(session.bookingDraft, beforeRebook);
    await send("Giữ bản đang soạn.", { type: "rebook_decision", proposalId: session.rebookProposal!.id, accept: false });
    assert.deepEqual(session.bookingDraft, beforeRebook);
    await send(rebook);
    await send("Chuyển sang đặt lại.", { type: "rebook_decision", proposalId: session.rebookProposal!.id, accept: true });
    assert.equal(session.bookingDraft.values.uniformQuantity, 2);
    assert.equal(session.bookingDraft.values.preferredProviderId, providerId);
    assert.equal(session.bookingDraft.values.scheduledAt, undefined);
    assert.deepEqual(session.draftBackup?.draft, JSON.parse(JSON.stringify(beforeRebook)));
    const backupId = session.draftBackup!.id;
    const guardedLoop = new AgentLoop({ generate: async () => { throw Error("Không gọi AI khi công cụ bị khóa."); } },
      new ToolRegistry({ update_booking_draft: { enabled: false } }).register(createUpdateBookingDraftTool(deps)),
      { maxIterations: 1, timeoutMs: 2000, systemPrompt: "Kiểm thử" });
    const guardedAgent = new AgentService({ acquire: async () => ({ session, lockId: "khoa" }), save: async () => {}, release: async () => {} }, guardedLoop);
    await guardedAgent.send(user, session.id, { requestId: randomUUID(), message: "Khôi phục khi công cụ bị khóa.", bookingAction: { type: "restore_draft", backupId } });
    assert.equal(session.bookingDraft.values.uniformQuantity, 2, "Khôi phục cũng tôn trọng cấu hình khóa công cụ trước khi đổi trạng thái.");
    assert.equal(session.draftBackup?.id, backupId);
    await send("Quay lại bản nháp.", { type: "restore_draft", backupId });
    assert.deepEqual(session.bookingDraft.values, beforeRebook.values);
    assert.deepEqual(session.bookingDraft.draftAddress, beforeRebook.draftAddress, "Khôi phục đầy đủ địa chỉ tạm mà chưa lưu vào sổ.");
    assert.deepEqual(session.bookingDraft.values.customerAttachments, session.uploadedAttachments);
    assert.equal(session.draftBackup, undefined);
    assert.equal(writes, 1);

    failProviders = true;
    await change({ preferredProviderId: providerId });
    assert(session.recovery, "Lỗi tìm thợ giữ bước có thể thử lại, không coi là danh sách rỗng.");
    failProviders = false;
    await send(CONTINUE_REQUEST);
    assert.equal(session.bookingDraft.values.preferredProviderId, providerId);
    assert.equal(session.recovery, undefined);
    assert(session.pendingAction);

    mock.method(AgentQuotationService, "get", async (_owner: string, target: string) => {
      quoteCalls++;
      if (failQuote) throw Error("Lỗi nguồn báo giá giả lập");
      return { orderId: target, orderCode: "HD-CU", quotation: null, note: "Đơn chưa có báo giá hiện tại." };
    });
    await send(`Xem báo giá đơn ${orderId} (HD-CU) từ kết quả tìm đơn cũ.`);
    assert(session.conversation[session.conversation.length - 1]?.content.includes("chưa có báo giá"));
    assert.equal(session.viewedOrder?.orderId, orderId);
    assert.equal(session.bookingDraft.values.uniformQuantity, 4);
    const beforeAmbiguous = quoteCalls;
    await send("Xem báo giá đơn này.");
    assert.equal(quoteCalls, beforeAmbiguous, "Nhiều ngữ cảnh đơn phải hỏi lại, không đoán đơn.");
    assert.equal(modelCalls, 0);
    failQuote = true;
    await send(`Xem báo giá đơn ${orderId}.`);
    assert(session.recovery);
    assert(!session.conversation[session.conversation.length - 1]?.content.includes("chưa có báo giá"));
    failQuote = false;
    const beforeRetry = quoteCalls;
    await send("Tiếp tục yêu cầu.");
    assert.equal(quoteCalls, beforeRetry + 1);
    assert.equal(modelCalls, 0);
    const fallbackSession = newSession(randomUUID(), user.id);
    let narrativeCalls = 0;
    const fallbackLoop = new AgentLoop({ generate: async () => {
      if (++narrativeCalls === 1) return { type: "TOOL_CALL" as const, tool: "get_booking_quotation", arguments: { orderId } };
      throw new SyntaxError("Lỗi diễn giải giả lập sau khi đã đọc dữ liệu.");
    } }, registry, { maxIterations: 4, timeoutMs: 2000, systemPrompt: "Kiểm thử" });
    const fallbackAgent = new AgentService({ acquire: async () => ({ session: fallbackSession, lockId: "khoa" }), save: async () => {}, release: async () => {} }, fallbackLoop);
    const fallbackView = await fallbackAgent.send(user, fallbackSession.id, { requestId: randomUUID(), message: "Giải thích báo giá giúp tôi." });
    assert.equal(fallbackView.state, "WAITING_USER_INPUT");
    assert(fallbackView.messages[fallbackView.messages.length - 1].content.includes("chưa có báo giá"), "Giữ kết quả đã đọc nếu lượt diễn giải của AI lỗi; câu tự nhiên vẫn có thể tiếp tục nhiều bước khi AI hoạt động.");

    let orderStatus = "cancelled", paymentStatus = "refunded", inspection = true;
    mock.method(Order, "findOne", (filter: { customerId: string; _id: string }) => {
      assert.equal(filter.customerId, user.id); assert.equal(filter._id, orderId);
      return { select: () => ({ lean: () => ({ exec: async () => ({ _id: orderId, orderCode: "HD-CU", status: orderStatus,
        paymentStatus, inspectionRequired: inspection, currentQuotationId: null, bookingStatus: "not_required" }) }) }) } as never;
    });
    session.bookingDraft.orderId = id();
    let view = await withOrderActions(sessionView(session), user.id);
    assert.equal(view.orderActions?.orderId, orderId, "Đơn đang xem không bị thay bằng đơn của bản nháp.");
    assert(view.orderActions?.refunds && view.orderActions.quotation && view.orderActions.rebook);
    assert.equal(view.orderActions?.payment, false);
    orderStatus = "created"; paymentStatus = "unpaid"; inspection = false;
    view = await withOrderActions(sessionView(session), user.id);
    assert.equal(view.orderActions?.refunds, false); assert.equal(view.orderActions?.quotation, false);
    assert.equal(view.orderActions?.rebook, false); assert.equal(view.orderActions?.payment, true);
    session.requiresReconciliation = true;
    view = await withOrderActions(sessionView(session), user.id);
    assert.equal(view.orderActions?.quotation, false);
    assert.equal(view.orderActions?.rebook, false);
    assert.equal(writes, 1);

    const configs = await import("../services/systemConfig.service");
    const policies = await import("../services/bookingPolicy.service");
    const { DEFAULT_BOOKING_POLICY } = await import("../validations/bookingPolicy.validator");
    const { DEFAULT_REFUND_POLICY } = await import("../validations/refundPolicy.validator");
    let holdMinutes = 17;
    mock.method(configs, "getBookingPolicy", async () => ({ ...DEFAULT_BOOKING_POLICY, paymentHoldMinutes: holdMinutes }));
    mock.method(configs, "getRefundPolicy", async () => DEFAULT_REFUND_POLICY);
    mock.method(configs, "getNumberConfigValue", async (_key: string, fallback: number) => fallback);
    const firstPolicies = await policies.getCustomerBookingPolicies();
    assert.equal(firstPolicies.version, (await policies.getCustomerBookingPolicies()).version);
    holdMinutes = 18;
    const changedPolicies = await policies.getCustomerBookingPolicies();
    assert.notEqual(changedPolicies.version, firstPolicies.version, "Đổi điều khoản công khai làm thay đổi phiên bản chính sách.");
    mock.method(AgentBookingService, "preview", async () => ({ title: "Tạo đơn", amount: 200000 }) as never);
    const { createBookingTool } = await import("../ai/tools/implementations/create-booking.tool");
    const preview = await createBookingTool.preview!({ user, sessionId: session.id, session, signal: AbortSignal.timeout(2000) },
      bookingSchema.parse({ serviceId, addressId, orderType: "normal", paymentMethod: "bank" })) as { policyVersion: string; bookingPolicies: unknown };
    assert.equal(preview.policyVersion, changedPolicies.version);
    assert.deepEqual(preview.bookingPolicies, changedPolicies, "Bản xác nhận giữ snapshot để đối chiếu nội dung đã đồng ý sau này.");
    console.log("Đạt P1: nút có dữ liệu cấu trúc, chống sửa từ tab cũ, đồng ý đúng chính sách, giữ/khôi phục bản nháp, thợ trùng tên, lỗi nguồn/thử lại đúng bước, kết quả đọc không phụ thuộc AI và hành động đúng đơn/trạng thái.");
  } finally { mock.restoreAll(); }
}
run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
