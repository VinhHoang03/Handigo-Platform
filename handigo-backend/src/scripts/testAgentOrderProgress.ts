import assert from "node:assert/strict";
import { mock } from "node:test";
import { Types } from "mongoose";
import type { ChangeStreamDocument, Document } from "mongodb";
import { AgentCaseSubscription, AgentOrderMessage, AgentOrderSubscription } from "../models/agentOrderProgress.model";
import { Order } from "../models/order.model";
import { Payment } from "../models/payment.model";
import { RepairQuotation } from "../models/repairQuotation.model";
import { Refund } from "../models/refund.model";
import { SupportTicket } from "../models/supportTicket.model";
import { Complaint } from "../models/complaint.model";
import * as socketServer from "../sockets/socketServer";
import { describeOrderProgress, mergeAgentOrderMessages, publishAgentOrderChange, restoreAgentProgressTracking, safelyTrackAgentBooking, safelyTrackAgentCase, trackAgentBooking } from "../services/agentOrderProgress.service";
import { newSession } from "../ai/agent/agent-state";

// Kiểm thử không kết nối database, không đọc cấu hình bí mật hoặc gọi cổng thanh toán.
async function run() {
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
  for (const model of [Refund, SupportTicket, Complaint]) mock.method(model, "find", () => ({ lean: async () => [] }));
  mock.method(Order, "findOne", (filter: Record<string, unknown>) => {
    assert.equal(filter.customerId, subscription.userId);
    assert.equal(filter.isDeleted, false);
    const lean = async () => ownsOrder ? { _id: orderId, orderCode: "ORD-KIEM-THU", status: "created", paymentStatus: "unpaid" } : null;
    return { lean, select: () => ({ lean }) };
  });
  mock.method(AgentOrderMessage, "updateOne", async (filter: { _id: string }, update: {
    $setOnInsert: { content: string; createdAt: Date };
  }) => {
    assert.ok(!Object.prototype.hasOwnProperty.call(update.$setOnInsert, "_id"), "Không đưa _id của đăng ký theo dõi vào bản ghi tin nhắn.");
    if (stored.has(filter._id)) return { upsertedCount: 0 };
    stored.set(filter._id, { _id: filter._id, ...update.$setOnInsert });
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
  assert.equal(stored.size, 2, "Phát lại event sau kết nối lại không tạo tin nhắn trùng.");
  assert.equal(emitted.length, 2);
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
  assert.ok([...stored.values()].some((message) => message.content.includes("tiền cọc khảo sát đã thành công")));
  assert.ok([...stored.values()].some((message) => message.content.includes("thất bại hoặc hết hạn")));
  assert.ok([...stored.values()].some((message) => message.content.includes("được hoàn tiền")));
  assert.ok([...stored.values()].some((message) => message.content.includes("Báo giá đã được chấp nhận")));

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

  const refund = { customerId: subscription.userId, amount: 70000, destination: "handigo_wallet",
    lastError: "THONG-TIN-NOI-BO", providerResponse: { account: "TAI-KHOAN-NHAY-CAM" } };
  for (const [index, status] of ["requested", "requesting", "pending", "failed", "failed", "manual_review", "succeeded"].entries()) {
    await publishAgentOrderChange(change(`hoan-${status}-${index}`, Refund.collection.collectionName, { status }, refund));
  }
  const refundMessages = [...stored.values()].filter((message) => message._id.startsWith("order-event:refund:"));
  assert.equal(refundMessages.length, 5, "Gộp mốc đang xử lý và không lặp khi worker thử lại.");
  assert.ok(refundMessages.every((message) => message.content.includes("70.000 đồng") && message.content.includes("ví Handigo")));
  assert.ok(refundMessages.some((message) => message.content.includes("tự động thử lại")));
  assert.ok(refundMessages.some((message) => message.content.includes("bộ phận hỗ trợ kiểm tra")));
  assert.ok(refundMessages.every((message) => !message.content.includes("THONG-TIN-NOI-BO") && !message.content.includes("TAI-KHOAN-NHAY-CAM")));
  const afterRefund = stored.size;
  await publishAgentOrderChange(change("hoan-khac-khach", Refund.collection.collectionName, { status: "requested" },
    { ...refund, customerId: new Types.ObjectId() }));
  await publishAgentOrderChange(change("hoan-noi-bo", Refund.collection.collectionName, { attemptCount: 3 }, refund));
  assert.equal(stored.size, afterRefund);

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
  await publishAgentOrderChange(change("yeu-cau-bang-chung", Complaint.collection.collectionName,
    { status: "evidence_requested", requestedEvidenceNote: "Vui lòng bổ sung ảnh." },
    { complainantId: subscription.userId, complainantRole: "CUSTOMER", title: "Chất lượng dịch vụ" }));
  assert.ok([...stored.values()].some((message) => message.content.includes("Vui lòng bổ sung ảnh.")));
  const beforeForbidden = stored.size;
  await publishAgentOrderChange(change("ho-tro-tho", SupportTicket.collection.collectionName, { status: "resolved" },
    { ...ticket, requesterId: new Types.ObjectId() }));
  await publishAgentOrderChange(change("khieu-nai-tho", Complaint.collection.collectionName, { status: "resolved" },
    { complainantId: subscription.userId, complainantRole: "PROVIDER" }));
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
