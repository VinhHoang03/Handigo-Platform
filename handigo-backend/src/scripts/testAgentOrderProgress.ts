import assert from "node:assert/strict";
import { mock } from "node:test";
import { Types } from "mongoose";
import { MemorySaver } from "@langchain/langgraph";
import type { ChangeStreamDocument, Document } from "mongodb";
import { AgentCaseSubscription, AgentOrderMessage, AgentOrderSubscription } from "../models/agentOrderProgress.model";
import { Order } from "../models/order.model";
import { Payment } from "../models/payment.model";
import { RepairQuotation } from "../models/repairQuotation.model";
import { Refund } from "../models/refund.model";
import { SupportTicket } from "../models/supportTicket.model";
import { Report } from "../models/report.model";
import * as socketServer from "../sockets/socketServer";
import { combineAgentBookingPayment, describeOrderProgress, mergeAgentOrderMessages, publishAgentOrderChange, restoreAgentProgressTracking, restoreAgentSessionTracking, safelyTrackAgentBooking, safelyTrackAgentCase, trackAgentBooking } from "../services/agentOrderProgress.service";
import { newSession } from "../ai/agent/agent-state";
import { AgentService, sessionView } from "../ai/agent/agent.service";
import { AgentLoop } from "../ai/agent/agent-loop.service";
import { ToolRegistry } from "../ai/tools/tool-registry";
import { getPaymentStatusTool } from "../ai/tools/implementations/payment.tools";
import { buildCustomerSessionGraph, projectCustomerWorkflow, type CustomerWorkflowData } from "../ai/runtime/customer-workflow-state";
import { CUSTOMER_GRAPH_VERSION } from "../ai/runtime/mongo-graph-access";

// Kiểm thử không kết nối database, không đọc cấu hình bí mật hoặc gọi cổng thanh toán.
async function run() {
  const escalatedAt = new Date();
  const overdueMessage = "Đơn hàng quá thời gian dự kiến và đang cần xác nhận tiến độ.";
  assert.deepEqual(describeOrderProgress({ "overdueReview.escalatedAt": escalatedAt }), [overdueMessage]);
  assert.deepEqual(describeOrderProgress({ overdueReview: { escalatedAt } }), [overdueMessage]);
  assert.deepEqual(describeOrderProgress({ overdueReview: { escalatedAt }, "overdueReview.escalatedAt": escalatedAt }), [overdueMessage]);
  for (const overdueReview of [null, undefined, {}, { escalatedAt: null }]) {
    assert.deepEqual(describeOrderProgress({ overdueReview }), []);
  }
  const orderId = new Types.ObjectId();
  const subscription = { _id: new Types.ObjectId(), orderId, userId: new Types.ObjectId().toString(), sessionId: "phien-kiem-thu",
    createdAt: new Date("2026-10-01T00:00:00Z") };
  const stored = new Map<string, { _id: string; content: string; createdAt: Date }>();
  const emitted: Array<{ userId: string; event: string }> = [];
  let ownsOrder = true;
  let tracked = true;
  let caseTracked = false;
  mock.method(socketServer, "emitToUser", (userId: string, event: string) => emitted.push({ userId, event }));
  mock.method(AgentOrderSubscription, "findOne", () => ({ lean: async () => tracked ? subscription : null }));
  mock.method(AgentOrderSubscription, "updateOne", async () => ({}));
  mock.method(AgentCaseSubscription, "findOne", () => ({ lean: async () => caseTracked ? subscription : null }));
  mock.method(Order, "exists", async (filter: Record<string, unknown>) => {
    assert.equal(filter.customerId, subscription.userId);
    assert.equal(filter.isDeleted, false);
    return ownsOrder ? { _id: orderId } : null;
  });
  mock.method(AgentOrderMessage, "exists", async (filter: { _id: string }) => stored.has(filter._id) ? { _id: filter._id } : null);
  mock.method(AgentOrderMessage, "findOne", (filter: { _id: string; userId: string; sessionId: string }) => {
    assert.equal(filter.userId, subscription.userId);
    assert.equal(filter.sessionId, subscription.sessionId);
    return { lean: async () => stored.get(filter._id) ?? null };
  });
  for (const model of [Refund, Payment, SupportTicket, Report]) mock.method(model, "find", () => ({ lean: async () => [] }));
  mock.method(Order, "findOne", (filter: Record<string, unknown>) => {
    assert.equal(filter.customerId, subscription.userId);
    assert.equal(filter.isDeleted, false);
    const lean = async () => ownsOrder ? { _id: orderId, orderCode: "ORD-KIEM-THU", status: "created", paymentStatus: "unpaid" } : null;
    return { lean, select: () => ({ lean }) };
  });
  mock.method(AgentOrderMessage, "updateOne", async (filter: { _id: string; content?: string }, update: {
    $setOnInsert: { content?: string; createdAt: Date }; $set?: { content: string };
  }) => {
    assert.ok(!Object.prototype.hasOwnProperty.call(update.$setOnInsert, "_id"), "Không đưa _id của đăng ký theo dõi vào bản ghi tin nhắn.");
    const previous = stored.get(filter._id);
    if (previous) {
      if (filter.content !== undefined && previous.content !== filter.content) return { upsertedCount: 0, modifiedCount: 0, matchedCount: 0 };
      const modifiedCount = update.$set && update.$set.content !== previous.content ? 1 : 0;
      if (update.$set) Object.assign(previous, update.$set);
      return { upsertedCount: 0, modifiedCount, matchedCount: 1 };
    }
    stored.set(filter._id, { _id: filter._id, ...update.$setOnInsert, content: update.$set?.content ?? update.$setOnInsert.content! });
    return { upsertedCount: 1 };
  });
  mock.method(AgentOrderMessage, "find", (filter: Record<string, unknown>) => {
    assert.equal(filter.sessionId, subscription.sessionId);
    assert.equal(filter.userId, subscription.userId);
    return { sort: () => ({ lean: async () => [...stored.values()] }) };
  });
  const change = (token: string, collection: string, fields: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
    _id: { _data: token }, operationType: "update", ns: { coll: collection, db: "kiem-thu" },
    fullDocument: { _id: orderId, orderId, isDeleted: false, ...extra },
    updateDescription: { updatedFields: fields, removedFields: [], truncatedArrays: [] },
    wallTime: new Date("2026-10-01T01:00:00Z"),
  } as unknown as ChangeStreamDocument<Document>);

  await trackAgentBooking(subscription.userId, subscription.sessionId, orderId.toString());
  assert.match([...stored.values()][0].content, /tự động cập nhật tiến độ/);
  await trackAgentBooking(subscription.userId, subscription.sessionId, orderId.toString());
  assert.equal(stored.size, 1, "Đăng ký lại không gửi trùng trạng thái ban đầu.");

  const paid = change("thanh-toan", Order.collection.collectionName, { paymentStatus: "paid" });
  await publishAgentOrderChange(paid);
  await publishAgentOrderChange(paid);
  assert.equal(stored.size, 1, "Không phát tin thanh toán riêng từ trạng thái Order.");
  assert.equal(emitted.length, 1);
  assert.ok(emitted.every((event) => event.userId === subscription.userId && event.event === "agent:order:message"));

  // updateLookup có thể đã thấy trạng thái mới hơn; phải dùng trạng thái của chính event.
  await publishAgentOrderChange(change("bat-dau", Order.collection.collectionName, { status: "in_progress" }, { status: "completed" }));
  await publishAgentOrderChange(change("hoan-tat", Order.collection.collectionName, { status: "completed" }));
  assert.ok([...stored.values()].some((message) => message.content.includes("đang thực hiện")));
  assert.ok([...stored.values()].some((message) => message.content.includes("đã hoàn tất")));
  await publishAgentOrderChange(change("coc", Payment.collection.collectionName, { status: "paid" }, { paymentType: "inspection_deposit" }));
  await publishAgentOrderChange(change("loi", Payment.collection.collectionName, { status: "failed" }));
  await publishAgentOrderChange(change("hoan-tien", Payment.collection.collectionName, { status: "refunded" }));
  await publishAgentOrderChange(change("bao-gia", RepairQuotation.collection.collectionName, { status: "approved" }));
  assert.ok(stored.get(`booking:${orderId}`)?.content.includes("Đã thanh toán tiền cọc."));
  assert.ok(!stored.get(`booking:${orderId}`)?.content.includes("chưa thanh toán"));
  assert.ok([...stored.values()].some((message) => message.content.includes("thất bại hoặc hết hạn")));
  const beforeSwitch = stored.size;
  await publishAgentOrderChange(change("doi-phuong-thuc", Payment.collection.collectionName, { status: "failed" },
    { failureReason: "Đã hủy PayOS để đổi phương thức thanh toán" }));
  assert.equal(stored.size, beforeSwitch, "Không gửi tin riêng khi hủy QR cũ để đổi phương thức");
  assert.ok([...stored.values()].some((message) => message.content.includes("Khoản hoàn tiền đã hoàn tất")));
  assert.ok([...stored.values()].some((message) => message.content.includes("Báo giá đã được chấp nhận")));

  const combinedSession = newSession(subscription.sessionId, subscription.userId);
  combinedSession.conversation.push({ id: `booking:${orderId}`, role: "assistant", content: "Thông báo cũ chưa thanh toán", createdAt: subscription.createdAt.toISOString() },
    { id: "ket-qua-thanh-toan", role: "assistant", content: "Đã thanh toán tiền cọc. Chi phí sau khảo sát trả trực tiếp cho thợ.", createdAt: new Date().toISOString() });
  await combineAgentBookingPayment(combinedSession, { orderId: orderId.toString(), orderCode: "ORD-KIEM-THU", status: "deposit_paid",
    message: "Đã thanh toán tiền cọc. Chi phí sau khảo sát trả trực tiếp cho thợ." });
  assert.equal(combinedSession.conversation.filter((message) => message.content.includes("Đã thanh toán tiền cọc")).length, 1,
    "Tin thanh toán tự động gộp vào tin đặt đơn, không còn phản hồi riêng.");
  assert.ok(!combinedSession.conversation.some((message) => message.content.includes("chưa thanh toán")));
  await combineAgentBookingPayment(combinedSession, { orderId: orderId.toString(), orderCode: "ORD-KIEM-THU", status: "pending",
    message: "Đang chờ thanh toán. Bạn quét mã QR bên dưới để thanh toán." });
  assert.ok(stored.get(`booking:${orderId}`)?.content.includes("Đã thanh toán tiền cọc."), "Phản hồi chờ đến muộn không ghi đè mốc đã thanh toán.");
  assert.ok(!stored.get(`booking:${orderId}`)?.content.includes("Đang chờ thanh toán."));
  const afterPayment = emitted.length;
  await publishAgentOrderChange(change("coc-lap-lai", Payment.collection.collectionName, { status: "paid" }, { paymentType: "inspection_deposit" }));
  assert.equal(emitted.length, afterPayment, "Sự kiện cọc phát lại không gửi tin thừa.");
  // Kiểm tra QR tự động không gửi thêm tin thành công khi đã cập nhật cùng thẻ tiến độ.
  const paymentSession = newSession(subscription.sessionId, subscription.userId);
  await mergeAgentOrderMessages(paymentSession);
  const paymentMessage = "Đã thanh toán thành công.";
  const paymentResult = { orderId: orderId.toString(), orderCode: "ORD-KIEM-THU", status: "paid" as const,
    amount: 100000, paymentType: "full" as const, method: "payos", message: paymentMessage };
  const registry = new ToolRegistry().register({ ...getPaymentStatusTool, execute: async () => paymentResult });
  const service = new AgentService({
    acquire: async () => ({ session: paymentSession, lockId: "khoa-kiem-thu" }),
    save: async () => {}, release: async () => {},
  }, new AgentLoop({ generate: async () => { throw new Error("Không gọi model khi kiểm tra QR."); } },
    registry, { systemPrompt: "", maxIterations: 1, timeoutMs: 10000 }));
  const statusInput = { requestId: "kiem-tra-qr", paymentStatus: { orderId: orderId.toString() } };
  await service.send({ id: subscription.userId, role: "CUSTOMER" }, paymentSession.id, statusInput);
  assert.ok(paymentSession.conversation.find((message) => message.id === `booking:${orderId}`)?.content.includes(paymentMessage));
  assert.ok(!sessionView(paymentSession).messages.some((message) => message.content === paymentMessage),
    "Không gửi tin thành công riêng sau khi thẻ tiến độ đã chứa kết quả.");
  const messageCount = paymentSession.conversation.length;
  await service.send({ id: subscription.userId, role: "CUSTOMER" }, paymentSession.id, statusInput);
  assert.equal(paymentSession.conversation.length, messageCount, "Thử lại cùng request không thêm thông báo.");
  paymentSession.conversation = [];
  await service.send({ id: subscription.userId, role: "CUSTOMER" }, paymentSession.id,
    { ...statusInput, requestId: "kiem-tra-khong-co-the-tien-do" });
  assert.ok(sessionView(paymentSession).messages.some((message) => message.content === paymentMessage),
    "Giữ thông báo thành công khi chưa có thẻ tiến độ đơn.");
  assert.match(describeOrderProgress({ scheduledAt: "2026-10-16T12:07:00Z" }).join("\n"), /16\/10\/2026 lúc 19:07\./);

  await publishAgentOrderChange(change("huy-don", Order.collection.collectionName, { status: "cancelled", cancellation: { reason: "Khách đổi lịch" } }));
  const cancelled = stored.get(`order-event:cancelled:${orderId}`);
  assert.ok(cancelled?.content.includes("Lý do: Khách đổi lịch"));
  assert.ok(describeOrderProgress({ status: "cancelled" }).includes("Lý do: Chưa có thông tin."));

  const count = stored.size;
  await publishAgentOrderChange(change("khong-lien-quan", Order.collection.collectionName, { updatedAt: new Date(), problemDescription: "Nội dung riêng tư" }));
  tracked = false;
  await publishAgentOrderChange(change("khong-theo-doi", Order.collection.collectionName, { status: "completed" }));
  tracked = true;
  ownsOrder = false;
  await publishAgentOrderChange(change("khong-so-huu", Order.collection.collectionName, { status: "completed" }));
  await assert.rejects(trackAgentBooking(subscription.userId, subscription.sessionId, orderId.toString()), /Không tìm thấy đơn hàng/);
  ownsOrder = true;
  const old = change("truoc-dang-ky", Order.collection.collectionName, { status: "accepted" });
  if (old.operationType === "update") old.wallTime = new Date("2026-09-01T00:00:00Z");
  await publishAgentOrderChange(old);
  assert.equal(stored.size, count, "Không gửi sự kiện cũ, không liên quan hoặc ngoài quyền sở hữu.");

  const session = newSession(subscription.sessionId, subscription.userId);
  session.conversation.push({ id: "khach", role: "user", content: "Đặt dịch vụ", createdAt: "2026-09-30T00:00:00.000Z" });
  await mergeAgentOrderMessages(session);
  await mergeAgentOrderMessages(session);
  assert.equal(session.conversation.length, count + 1);
  assert.equal(session.conversation[0].id, "khach");
  const staleCheckpoint = newSession(subscription.sessionId, subscription.userId);
  await mergeAgentOrderMessages(staleCheckpoint);
  assert.equal(staleCheckpoint.conversation.length, count, "Thông báo vẫn còn sau khi phiên ghi checkpoint cũ.");
  assert.deepEqual(describeOrderProgress({ "reassignment.status": "matching", "confirmation.providerConfirmedAt": new Date() }),
    ["Nhà cung cấp đã xác nhận hoàn thành dịch vụ.", "Đang tìm kỹ thuật viên thay thế."]);

  const refund = { paymentId: new Types.ObjectId(), customerId: subscription.userId, amount: 70000, destination: "handigo_wallet",
    lastError: "THONG-TIN-NOI-BO", providerResponse: { account: "TAI-KHOAN-NHAY-CAM" } };
  for (const [index, status] of ["requested", "requesting", "pending", "failed", "failed", "manual_review", "succeeded"].entries()) {
    const emittedBeforeRefund: number = emitted.length;
    await publishAgentOrderChange(change(`hoan-${status}-${index}`, Refund.collection.collectionName, { status }, refund));
    if (["requested", "requesting", "pending", "failed"].includes(status)) {
      assert.equal(emitted.length, emittedBeforeRefund, "Không phát thông báo hoàn tiền trung gian hoặc mỗi lần thử lại.");
    }
  }
  const refundMessages = [...stored.values()].filter((message) => message._id.startsWith("order-event:refund:") && message.content.includes("70.000 đồng"));
  assert.equal(refundMessages.length, 2, "Chỉ báo khi cần hỗ trợ và khi hoàn tiền thành công.");
  assert.ok(refundMessages.every((message) => message.content.includes("70.000 đồng") && message.content.includes("ví Handigo")));
  assert.ok(refundMessages.every((message) => !message.content.includes("tự động thử lại") && !message.content.includes("đang được xử lý")));
  assert.ok(refundMessages.some((message) => message.content.includes("bộ phận hỗ trợ kiểm tra")));
  assert.ok(refundMessages.every((message) => !message.content.includes("THONG-TIN-NOI-BO") && !message.content.includes("TAI-KHOAN-NHAY-CAM")));
  const beforeDuplicateRefund = stored.size;
  await publishAgentOrderChange(change("hoan-tu-payment", Payment.collection.collectionName, { status: "refunded" }, { _id: refund.paymentId }));
  await publishAgentOrderChange(change("hoan-tu-order", Order.collection.collectionName, { paymentStatus: "refunded" }));
  await publishAgentOrderChange(change("hoan-thanh-lap", Refund.collection.collectionName, { status: "succeeded" }, refund));
  assert.equal(stored.size, beforeDuplicateRefund, "Order, Payment và Refund chỉ có một tin hoàn thành cho cùng giao dịch.");
  assert.equal([...stored.values()].filter((message) => message._id === `order-event:refund:${refund.paymentId}:succeeded`).length, 1);
  assert.ok(stored.get(`order-event:refund:${refund.paymentId}:succeeded`)?.content.includes("70.000 đồng"), "Payment đến muộn không làm mất chi tiết khoản hoàn.");
  const walletPaymentId = new Types.ObjectId();
  const beforeWalletRefund = stored.size;
  await publishAgentOrderChange(change("vi-hoan-truoc", Payment.collection.collectionName, { status: "refunded" }, {
    _id: walletPaymentId, method: "wallet", metadata: { refund: { amount: 40000, destination: "handigo_wallet" } },
  }));
  await publishAgentOrderChange(change("refund-den-sau", Refund.collection.collectionName, { status: "succeeded" }, {
    ...refund, _id: new Types.ObjectId(), paymentId: walletPaymentId, amount: 40000,
  }));
  assert.equal(stored.size, beforeWalletRefund + 1, "Payment đến trước Refund vẫn chỉ có một tin hoàn thành.");
  assert.ok(stored.get(`order-event:refund:${walletPaymentId}:succeeded`)?.content.includes("40.000 đồng"));
  const afterRefund = stored.size;
  await publishAgentOrderChange(change("hoan-khac-khach", Refund.collection.collectionName, { status: "requested" },
    { ...refund, customerId: new Types.ObjectId() }));
  await publishAgentOrderChange(change("hoan-noi-bo", Refund.collection.collectionName, { attemptCount: 3 }, refund));
  assert.equal(stored.size, afterRefund);
  const legacyRefundSession = newSession(subscription.sessionId, subscription.userId);
  const legacyIds = ["requested", "processing", "failed"].map((stage) => `order-event:refund:${orderId}:${stage}`);
  for (const id of legacyIds) {
    const message = { _id: id, content: "Thông báo hoàn tiền trung gian cũ", createdAt: new Date() };
    stored.set(id, message);
    legacyRefundSession.conversation.push({ id, role: "assistant", content: message.content, createdAt: message.createdAt.toISOString() });
  }
  legacyRefundSession.conversation.push({ id: "khach-hoi-hoan-tien", role: "user", content: "Hoàn tiền đang được xử lý chưa?", createdAt: new Date().toISOString() });
  await mergeAgentOrderMessages(legacyRefundSession);
  assert.ok(!legacyRefundSession.conversation.some((message) => legacyIds.includes(message.id)), "Ẩn thông báo trung gian trong checkpoint và lịch sử cũ.");
  assert.ok(legacyIds.every((id) => stored.has(id)), "Không xóa bản ghi lịch sử trong database.");
  assert.ok(legacyRefundSession.conversation.some((message) => message.id === "khach-hoi-hoan-tien"), "Giữ tin nhắn khách hỏi về hoàn tiền.");
  assert.ok(legacyRefundSession.conversation.some((message) => message.id === `order-event:refund:${refund.paymentId}:succeeded`), "Giữ kết quả hoàn tiền thành công.");

  const adminResponse = { responderRole: "ADMIN", message: "Đã kiểm tra giao dịch của bạn.",
    respondedAt: new Date("2026-10-01T00:30:00Z"), responderId: "ADMIN-NOI-BO" };
  const ticket = { requesterId: subscription.userId, subject: "Thanh toán đơn", responses: [
    { ...adminResponse, respondedAt: new Date("2026-09-01"), message: "Phản hồi cũ" },
    { ...adminResponse, responderRole: "USER", message: "Nội dung khách" }, adminResponse,
  ] };
  const responseEvent = change("phan-hoi", SupportTicket.collection.collectionName, { "responses.2": adminResponse }, ticket);
  await publishAgentOrderChange(responseEvent);
  await publishAgentOrderChange(responseEvent);
  const responseMessages = [...stored.values()].filter((message) => message._id.startsWith("order-event:ticket:"));
  assert.equal(responseMessages.length, 1, "Chỉ gửi phản hồi admin mới và không lặp event.");
  assert.ok(responseMessages[0].content.includes(adminResponse.message));
  assert.ok(!responseMessages[0].content.includes("ADMIN-NOI-BO"));
  await publishAgentOrderChange(change("ho-tro-cho-khach", SupportTicket.collection.collectionName,
    { status: "waiting_user" }, { ...ticket, status: "resolved" }));
  assert.ok([...stored.values()].some((message) => message.content.includes("đang chờ bạn phản hồi")),
    "Giữ mốc trung gian dù updateLookup đã thấy trạng thái mới hơn.");
  caseTracked = true;
  tracked = false;
  await publishAgentOrderChange(change("ho-tro-khong-don", SupportTicket.collection.collectionName,
    { status: "resolved", resolutionNote: "Đã hỗ trợ thành công." }, { ...ticket, orderId: null }));
  assert.ok([...stored.values()].some((message) => message.content.includes("Đã hỗ trợ thành công.")),
    "Theo dõi yêu cầu tạo qua agent ngay cả khi không gắn với đơn.");
  tracked = true;
  caseTracked = false;
  await publishAgentOrderChange(change("yeu-cau-bang-chung", Report.collection.collectionName,
    { status: "evidence_requested", requestedEvidenceNote: "Vui lòng bổ sung ảnh." },
    { reportType: "service_quality", reporterId: subscription.userId, reporterRole: "CUSTOMER", title: "Chất lượng dịch vụ" }));
  assert.ok([...stored.values()].some((message) => message.content.includes("Vui lòng bổ sung ảnh.")));
  const beforeForbidden = stored.size;
  await publishAgentOrderChange(change("ho-tro-tho", SupportTicket.collection.collectionName, { status: "resolved" },
    { ...ticket, requesterId: new Types.ObjectId() }));
  await publishAgentOrderChange(change("khieu-nai-tho", Report.collection.collectionName, { status: "resolved" },
    { reportType: "service_quality", reporterId: subscription.userId, reporterRole: "PROVIDER" }));
  ownsOrder = false;
  await publishAgentOrderChange(change("ho-tro-khong-so-huu", SupportTicket.collection.collectionName, { status: "resolved" }, ticket));
  ownsOrder = true;
  assert.equal(stored.size, beforeForbidden, "Không gửi hồ sơ của thợ/khách khác hoặc đơn ngoài quyền sở hữu.");

  let caseReads = 0;
  let initialized = false;
  mock.method(SupportTicket, "findOne", (filter: Record<string, unknown>) => {
    assert.equal(filter.requesterId, subscription.userId);
    return { lean: async () => ({ ...ticket, _id: orderId, orderId: null, createdAt: subscription.createdAt,
      updatedAt: new Date("2026-10-01T00:50:00Z"), status: caseReads++ === 0 ? "open" : "resolved",
      resolutionNote: "Kết quả khi đăng ký trễ" }) };
  });
  mock.method(AgentCaseSubscription, "updateOne", async (_filter: unknown, update: {
    $set?: { initializedAt: Date }; $setOnInsert?: { createdAt: Date };
  }, options: { runValidators: boolean }) => {
    assert.ok(options.runValidators);
    if (update.$setOnInsert) assert.equal(update.$setOnInsert.createdAt, subscription.createdAt);
    if (update.$set?.initializedAt) initialized = true;
    caseTracked = true;
    return {};
  });
  mock.method(AgentCaseSubscription, "exists", async () => null);
  const caseSession = newSession(subscription.sessionId, subscription.userId);
  caseSession.actions.push({ id: "tao-ho-tro", tool: "create_support_ticket", arguments: {}, preview: {}, taskVersion: 1,
    createdAt: new Date().toISOString(), expiresAt: new Date().toISOString(), status: "SUCCEEDED", result: { id: orderId.toString() } });
  await restoreAgentProgressTracking(caseSession);
  assert.ok(initialized, "Khôi phục đăng ký hỗ trợ từ checkpoint và đánh dấu sau khi bổ sung cập nhật.");
  assert.ok([...stored.values()].some((message) => message.content.includes("Kết quả khi đăng ký trễ")),
    "Đọc trạng thái sau khi đăng ký để không bỏ lỡ phản hồi xảy ra trong lúc thiết lập.");
  const brokenCaseRegistration = mock.method(AgentCaseSubscription, "updateOne", async () => { throw new Error("Lỗi theo dõi hồ sơ giả lập"); });
  await assert.doesNotReject(safelyTrackAgentCase(subscription.userId, subscription.sessionId, orderId.toString(), "ticket"));
  brokenCaseRegistration.mock.restore();
  caseTracked = false;

  const brokenRegistration = mock.method(AgentOrderSubscription, "updateOne", async () => { throw new Error("Lỗi theo dõi giả lập"); });
  await assert.doesNotReject(safelyTrackAgentBooking(subscription.userId, subscription.sessionId, orderId.toString()));
  brokenRegistration.mock.restore();
  stored.delete(`booking:${orderId}`);
  const recoveredSession = newSession(subscription.sessionId, subscription.userId);
  recoveredSession.actions.push({ id: "dat-don", tool: "create_booking", arguments: {}, preview: {}, taskVersion: 1,
    createdAt: new Date().toISOString(), expiresAt: new Date().toISOString(), status: "SUCCEEDED", result: { orderId: orderId.toString() } });
  await restoreAgentProgressTracking(recoveredSession);
  assert.ok(stored.has(`booking:${orderId}`), "Khôi phục đăng ký từ kết quả thành công đã lưu sau restart.");
  // Crash sau checkpoint thành công nhưng trước cache directory: đọc đúng nguồn graph.
  const emptyCache = newSession(subscription.sessionId, subscription.userId);
  const directory = { _id: subscription.sessionId, userId: subscription.userId,
    engine: "langgraph-customer" as const, data: emptyCache };
  const graph = buildCustomerSessionGraph(new MemorySaver());
  const graphConfig = { configurable: { thread_id: "checkpoint-khoi-phuc-theo-doi" } };
  await graph.updateState(graphConfig, { data: { version: CUSTOMER_GRAPH_VERSION, session: structuredClone(recoveredSession) } }, "session");
  let canonicalReads = 0;
  const loadCanonical = async (id: string, userId: string) => {
    assert.equal(id, subscription.sessionId); assert.equal(userId, subscription.userId);
    canonicalReads++;
    const snapshot = await graph.getState(graphConfig);
    return projectCustomerWorkflow(snapshot.values.data as CustomerWorkflowData, id, userId);
  };
  stored.delete(`booking:${orderId}`);
  await restoreAgentSessionTracking(directory, loadCanonical);
  assert.equal(canonicalReads, 1);
  assert.ok(stored.has(`booking:${orderId}`), "Cache rỗng không làm bỏ sót kết quả thành công trong checkpoint.");
  const countAfterCanonicalRecovery = stored.size;
  await restoreAgentSessionTracking(directory, loadCanonical);
  assert.equal(stored.size, countAfterCanonicalRecovery, "Quét lại checkpoint không lặp thông báo.");
  stored.delete(`booking:${orderId}`);
  await restoreAgentSessionTracking({ ...directory, data: recoveredSession }, async () => emptyCache);
  assert.ok(!stored.has(`booking:${orderId}`), "Cache thành công không cấp quyền theo dõi khi checkpoint chưa có kết quả.");
  await assert.rejects(restoreAgentSessionTracking({ ...directory, data: recoveredSession }, async () => {
    throw new Error("Kho checkpoint fixture lỗi.");
  }));
  assert.ok(!stored.has(`booking:${orderId}`), "Kho graph lỗi không dùng cache dự phòng.");
  await assert.rejects(restoreAgentSessionTracking(directory, async () => ({ ...recoveredSession, userId: "khach-khac" })));
  await assert.rejects(restoreAgentSessionTracking(directory, async () => ({ ...recoveredSession, id: "phien-khac" })));
  assert.ok(!stored.has(`booking:${orderId}`), "Không khôi phục từ checkpoint khác chủ/khác phiên.");
  const forbidGraphRead = async () => { throw new Error("Không được đọc graph trong nhánh này."); };
  await restoreAgentSessionTracking({ ...directory, deletedAt: new Date(), data: recoveredSession }, forbidGraphRead);
  await restoreAgentSessionTracking({ ...directory, engine: "langgraph-readonly", data: recoveredSession }, forbidGraphRead);
  assert.ok(!stored.has(`booking:${orderId}`), "Không tạo đăng ký cho phiên đã ẩn hoặc graph chỉ đọc.");
  await restoreAgentSessionTracking({ ...directory, engine: undefined, data: recoveredSession }, forbidGraphRead);
  assert.ok(stored.has(`booking:${orderId}`), "Phiên cũ chưa có engine vẫn khôi phục từ nguồn legacy.");
  initialized = false;
  await restoreAgentSessionTracking(directory, async () => caseSession);
  assert.ok(initialized, "Hỗ trợ cũng được khôi phục từ checkpoint khi directory chưa lưu kết quả.");
  initialized = false;
  mock.method(Complaint, "findOne", (filter: Record<string, unknown>) => {
    assert.equal(filter.complainantId, subscription.userId);
    assert.equal(filter.complainantRole, "CUSTOMER");
    return { lean: async () => ({ _id: orderId, complainantId: subscription.userId, complainantRole: "CUSTOMER",
      title: "Kiểm tra chất lượng", status: "pending", createdAt: subscription.createdAt }) };
  });
  const complaintSession = structuredClone(caseSession);
  complaintSession.actions[0].tool = "create_complaint";
  await restoreAgentSessionTracking(directory, async () => complaintSession);
  assert.ok(initialized, "Khiếu nại được khôi phục từ kết quả chuẩn với ownership CUSTOMER.");
  const readFailure = mock.method(AgentOrderMessage, "find", () => { throw new Error("Lỗi lịch sử giả lập"); });
  assert.equal(await mergeAgentOrderMessages(recoveredSession), recoveredSession, "Lỗi thông báo không làm mất kết quả thành công.");
  readFailure.mock.restore();
  mock.restoreAll();
  console.log("Đã kiểm tra tiến độ đơn, hoàn tiền, phản hồi hỗ trợ/khiếu nại, chống trùng, quyền sở hữu và khôi phục đăng ký theo dõi.");
}

void run().catch((error: unknown) => {
  mock.restoreAll();
  console.error("Kiểm thử thông báo tiến độ đơn thất bại.", error);
  process.exitCode = 1;
});
