import { createHash } from "node:crypto";
import mongoose from "mongoose";
import type { ChangeStream, ChangeStreamDocument, Document, ResumeToken } from "mongodb";
import { AgentCaseSubscription, AgentOrderCursor, AgentOrderMessage, AgentOrderSubscription } from "../models/agentOrderProgress.model";
import { Order } from "../models/order.model";
import { Payment } from "../models/payment.model";
import { RepairQuotation } from "../models/repairQuotation.model";
import { Refund } from "../models/refund.model";
import { SupportTicket } from "../models/supportTicket.model";
import { Complaint } from "../models/complaint.model";
import type { AgentSession } from "../ai/agent/agent-state";
import { emitToUser } from "../sockets/socketServer";
import { AppError } from "../utils/appError";
import { createLogger } from "../utils/logger";

const logger = createLogger("AgentOrderProgress");
const CURSOR_ID = "booking-progress";
const orderLabels: Record<string, string> = {
  created: "Đã tạo đơn, đang chờ xử lý.", accepted: "Nhà cung cấp đã nhận đơn.",
  in_progress: "Nhà cung cấp đang thực hiện dịch vụ.", completed: "Đơn hàng đã hoàn tất.",
  cancelled: "Đơn hàng đã được hủy.",
};
const bookingLabels: Record<string, string> = {
  awaiting_provider: "Đang chờ nhà cung cấp xác nhận lịch hẹn.",
  awaiting_payment: "Nhà cung cấp đã nhận lịch hẹn. Vui lòng thanh toán để xác nhận lịch.",
  reserved: "Lịch hẹn đang được giữ chỗ.", confirmed: "Lịch hẹn đã được xác nhận.",
  rejected: "Nhà cung cấp chưa thể nhận lịch hẹn.", expired: "Lịch hẹn đã hết thời hạn xác nhận.",
};
const paymentLabels: Record<string, string> = {
  unpaid: "Đơn hàng chưa thanh toán.", partially_paid: "Đã nhận thanh toán một phần của đơn hàng.",
  paid: "Đã thanh toán đơn hàng thành công.", refunded: "Đã hoàn tiền cho đơn hàng.",
};
const reassignmentLabels: Record<string, string> = {
  awaiting_customer: "Nhà cung cấp yêu cầu đổi kỹ thuật viên. Vui lòng phản hồi trong chi tiết đơn hàng.",
  matching: "Đang tìm kỹ thuật viên thay thế.", matched: "Đã tìm được kỹ thuật viên thay thế.",
  declined: "Bạn đã từ chối tìm kỹ thuật viên thay thế.", expired: "Yêu cầu đổi kỹ thuật viên đã hết hạn.",
  failed: "Chưa tìm được kỹ thuật viên thay thế.",
};

// Chỉ đưa các mốc nghiệp vụ công khai vào chat, không đưa ghi chú nội bộ hoặc dữ liệu cổng thanh toán.
export function describeOrderProgress(fields: Record<string, unknown>) {
  const lines: string[] = [];
  const label = (key: string, labels: Record<string, string>) => {
    const value = fields[key];
    if (typeof value === "string" && labels[value]) lines.push(labels[value]);
  };
  label("status", orderLabels);
  label("bookingStatus", bookingLabels);
  label("paymentStatus", paymentLabels);
  if (fields.depositPaidAt) lines.push("Đã nhận tiền cọc khảo sát.");
  if ("providerId" in fields) lines.push(fields.providerId
    ? "Đã phân công nhà cung cấp cho đơn hàng." : "Đang tìm nhà cung cấp cho đơn hàng.");
  if (fields.readyForMatching === true) lines.push("Đơn hàng đã sẵn sàng tìm nhà cung cấp.");
  if (fields.currentQuotationId) lines.push("Nhà cung cấp đã gửi báo giá. Vui lòng xem trong chi tiết đơn hàng.");
  if (fields.scheduledAt) {
    const date = new Date(String(fields.scheduledAt));
    if (Number.isFinite(date.getTime())) lines.push(`Lịch thực hiện: ${date.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}.`);
  }
  if (fields["confirmation.providerConfirmedAt"]) lines.push("Nhà cung cấp đã xác nhận hoàn thành dịch vụ.");
  if (fields["confirmation.customerConfirmedAt"]) lines.push("Bạn đã xác nhận hoàn thành dịch vụ.");
  if (fields["overdueReview.escalatedAt"]) lines.push("Đơn hàng quá thời gian dự kiến và đang cần xác nhận tiến độ.");
  label("reassignment.status", reassignmentLabels);
  const confirmation = fields.confirmation as Record<string, unknown> | undefined;
  if (confirmation?.providerConfirmedAt) lines.push("Nhà cung cấp đã xác nhận hoàn thành dịch vụ.");
  if (confirmation?.customerConfirmedAt) lines.push("Bạn đã xác nhận hoàn thành dịch vụ.");
  const reassignment = fields.reassignment as { status?: string } | undefined;
  if (reassignment?.status && reassignmentLabels[reassignment.status]) lines.push(reassignmentLabels[reassignment.status]);
  return [...new Set(lines)];
}

type Recipient = { sessionId: string; userId: string; orderId?: mongoose.Types.ObjectId; createdAt: Date };

async function deliver(subscription: Recipient,
  id: string, content: string, createdAt: Date) {
  const result = await AgentOrderMessage.updateOne({ _id: id }, { $setOnInsert: {
    sessionId: subscription.sessionId, userId: subscription.userId,
    ...(subscription.orderId ? { orderId: subscription.orderId } : {}), content, createdAt,
  } }, { upsert: true, runValidators: true });
  if (result.upsertedCount) emitToUser(subscription.userId, "agent:order:message", {
    sessionId: subscription.sessionId,
    message: { _id: id, sender: "assistant", content, createdAt: createdAt.toISOString() },
  });
}

export async function trackAgentBooking(userId: string, sessionId: string, orderId: string) {
  const order = await Order.findOne({ _id: orderId, customerId: userId, isDeleted: false }).lean();
  if (!order) throw new AppError("Không tìm thấy đơn hàng của bạn để theo dõi.", 404);
  await AgentOrderSubscription.updateOne({ orderId: order._id }, { $setOnInsert: {
    userId, sessionId, createdAt: order.createdAt,
  } }, { upsert: true, runValidators: true });
  const subscription = await AgentOrderSubscription.findOne({ orderId: order._id, userId, sessionId }).lean();
  if (!subscription) return;
  // Nạp lại sau khi đăng ký để bù cập nhật đã xảy ra trong lúc thiết lập theo dõi.
  const current = await Order.findOne({ _id: orderId, customerId: userId, isDeleted: false }).lean();
  if (!current) return;
  await recoverOrderDetails(userId, orderId);
  await deliver(subscription, `booking:${orderId}`, `Mình sẽ tự động cập nhật tiến độ đơn ${current.orderCode} tại đây.\n${describeOrderProgress(current as unknown as Record<string, unknown>).join("\n")}`, subscription.createdAt);
}

export async function safelyTrackAgentBooking(userId: string, sessionId: string, orderId: string) {
  try { await trackAgentBooking(userId, sessionId, orderId); }
  catch { logger.warn("Đơn đã tạo thành công; sẽ đăng ký theo dõi lại từ kết quả đã lưu trong phiên.", { orderId, sessionId }); }
}

export async function safelyTrackAgentCase(userId: string, sessionId: string, caseId: string, kind: "ticket" | "complaint") {
  try {
    let owned = kind === "ticket"
      ? await SupportTicket.findOne({ _id: caseId, requesterId: userId, isDeleted: false }).lean()
      : await Complaint.findOne({ _id: caseId, complainantId: userId, complainantRole: "CUSTOMER", isDeleted: false }).lean();
    if (!owned) return;
    await AgentCaseSubscription.updateOne({ caseId, kind }, { $setOnInsert: { userId, sessionId, createdAt: owned.createdAt } },
      { upsert: true, runValidators: true });
    owned = kind === "ticket"
      ? await SupportTicket.findOne({ _id: caseId, requesterId: userId, isDeleted: false }).lean()
      : await Complaint.findOne({ _id: caseId, complainantId: userId, complainantRole: "CUSTOMER", isDeleted: false }).lean();
    if (!owned) return;
    // Nếu đăng ký trễ, bổ sung trạng thái/phản hồi hiện tại đã phát sinh trước khi theo dõi.
    if (owned.status !== (kind === "ticket" ? "open" : "pending")
      || ("responses" in owned && owned.responses.some((response) => response.responderRole === "ADMIN"))) {
      await publishAgentOrderChange(snapshotChange(kind === "ticket" ? SupportTicket.collection.collectionName : Complaint.collection.collectionName,
        owned as unknown as Document));
    }
    await AgentCaseSubscription.updateOne({ caseId, kind, userId, sessionId }, { $set: { initializedAt: new Date() } },
      { runValidators: true });
  } catch { logger.warn("Hồ sơ đã tạo thành công; sẽ đăng ký theo dõi lại từ kết quả đã lưu trong phiên.", { caseId, sessionId }); }
}

export async function restoreAgentProgressTracking(session: AgentSession) {
  for (const action of session.actions) {
    if (action.status !== "SUCCEEDED" || !action.result || typeof action.result !== "object") continue;
    const result = action.result as Record<string, unknown>;
    if (action.tool === "create_booking" && typeof result.orderId === "string" && mongoose.isObjectIdOrHexString(result.orderId)) {
      if (!await AgentOrderMessage.exists({ _id: `booking:${result.orderId}`, sessionId: session.id, userId: session.userId })) {
        await safelyTrackAgentBooking(session.userId, session.id, result.orderId);
      }
    }
    if (["create_support_ticket", "create_complaint"].includes(action.tool)
      && typeof result.id === "string" && mongoose.isObjectIdOrHexString(result.id)) {
      const kind = action.tool === "create_support_ticket" ? "ticket" : "complaint";
      if (!await AgentCaseSubscription.exists({ caseId: result.id, kind, userId: session.userId, sessionId: session.id,
        initializedAt: { $exists: true } })) {
        await safelyTrackAgentCase(session.userId, session.id, result.id, kind);
      }
    }
  }
}

export async function mergeAgentOrderMessages(session: AgentSession) {
  try {
    const updates = await AgentOrderMessage.find({ sessionId: session.id, userId: session.userId })
      .sort({ createdAt: 1, _id: 1 }).lean();
    const ids = new Set(session.conversation.map((message) => message.id));
    for (const update of updates) if (!ids.has(update._id)) session.conversation.push({
      id: update._id, role: "assistant", content: update.content, createdAt: update.createdAt.toISOString(),
    });
    session.conversation.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch { logger.warn("Chưa thể nạp cập nhật tiến độ; kết quả thao tác trong phiên vẫn được giữ nguyên.", { sessionId: session.id }); }
  return session;
}

const money = (value: unknown) => typeof value === "number" && Number.isFinite(value)
  ? `${value.toLocaleString("vi-VN")} đồng` : null;

export function describeRefundProgress(doc: Record<string, unknown>, status: unknown) {
  const labels: Record<string, string> = {
    requested: "Đã tiếp nhận yêu cầu hoàn tiền.", requesting: "Khoản hoàn tiền đang được xử lý.",
    pending: "Khoản hoàn tiền đang được xử lý.",
    failed: "Khoản hoàn tiền chưa xử lý thành công. Hệ thống sẽ tự động thử lại; bạn không cần gửi yêu cầu mới.",
    manual_review: "Khoản hoàn tiền cần bộ phận hỗ trợ kiểm tra. Mình sẽ cập nhật khi có kết quả.",
    succeeded: "Khoản hoàn tiền đã hoàn tất.",
  };
  if (typeof status !== "string" || !labels[status]) return [];
  const lines = [labels[status]];
  const amount = money(doc.amount);
  if (amount) lines.push(`Số tiền hoàn: ${amount}.`);
  if (doc.destination === "handigo_wallet") lines.push("Nơi nhận tiền: ví Handigo.");
  if (doc.destination === "source_account") lines.push("Nơi nhận tiền: tài khoản nguồn thanh toán.");
  return lines;
}

async function publishCaseChange(change: ChangeStreamDocument<Document>, doc: Document, fields: Document) {
  if (!("ns" in change) || !("coll" in change.ns)) return;
  const ticket = change.ns.coll === SupportTicket.collection.collectionName;
  const kind = ticket ? "ticket" : "complaint";
  let recipient: Recipient | null = await AgentCaseSubscription.findOne({ caseId: doc._id, kind }).lean();
  if (!recipient && doc.orderId) recipient = await AgentOrderSubscription.findOne({ orderId: doc.orderId }).lean();
  if (!recipient || (change.wallTime && change.wallTime < recipient.createdAt)) return;
  // Một đơn có thể có hồ sơ của cả thợ và khách; chỉ gửi hồ sơ do chính khách tạo.
  if (String(ticket ? doc.requesterId : doc.complainantId) !== recipient.userId
    || (!ticket && doc.complainantRole !== "CUSTOMER")) return;
  if (doc.orderId && !await Order.exists({ _id: doc.orderId, customerId: recipient.userId, isDeleted: false })) return;
  const title = String(ticket ? doc.subject : doc.title).slice(0, 200);
  const lines: string[] = [];
  const labels: Record<string, string> = ticket
    ? { open: "Đã tiếp nhận yêu cầu hỗ trợ.", in_progress: "Yêu cầu hỗ trợ đang được xử lý.",
      waiting_user: "Bộ phận hỗ trợ đang chờ bạn phản hồi.", resolved: "Yêu cầu hỗ trợ đã được xử lý.",
      closed: "Yêu cầu hỗ trợ đã đóng.", cancelled: "Yêu cầu hỗ trợ đã hủy." }
    : { pending: "Đã tiếp nhận khiếu nại.", evidence_requested: "Khiếu nại cần bổ sung bằng chứng.",
      under_review: "Khiếu nại đang được xem xét.", resolved: "Khiếu nại đã được xử lý.",
      rejected: "Khiếu nại đã bị từ chối.", cancelled: "Khiếu nại đã hủy." };
  if (typeof fields.status === "string" && labels[fields.status]) lines.push(labels[fields.status]);
  for (const [key, label] of [["resolutionNote", "Kết quả xử lý"], ["requestedEvidenceNote", "Yêu cầu bổ sung"]]) {
    if (typeof fields[key] === "string" && fields[key].trim()) lines.push(`${label}: ${fields[key].slice(0, 3000)}`);
  }
  const at = change.wallTime ?? new Date();
  if (ticket) {
    // MongoDB có thể cập nhật cả mảng hoặc một phần tử; ID theo chỉ số ngăn gửi lại phản hồi cũ.
    const changed = change.operationType !== "update" || Object.keys(fields).some((key) => key === "responses" || key.startsWith("responses."));
    if (changed && Array.isArray(doc.responses)) for (const [index, response] of doc.responses.entries()) {
      if (response.responderRole !== "ADMIN" || typeof response.message !== "string"
        || new Date(response.respondedAt) < recipient.createdAt) continue;
      await deliver(recipient, `order-event:ticket:${doc._id}:response:${index}`,
        `Phản hồi hỗ trợ “${title}”:\n${response.message.slice(0, 3000)}\nBạn có thể phản hồi tại mục Hỗ trợ của tôi.`,
        new Date(response.respondedAt));
    }
  }
  if (!lines.length) return;
  const id = `order-event:${createHash("sha256").update(JSON.stringify(change._id)).digest("hex")}`;
  await deliver(recipient, id, `Cập nhật ${ticket ? "hỗ trợ" : "khiếu nại"} “${title}”:\n${lines.join("\n").slice(0, 5000)}\nXem chi tiết tại mục Hỗ trợ của tôi.`, at);
}

export async function publishAgentOrderChange(change: ChangeStreamDocument<Document>) {
  if (!["insert", "update", "replace"].includes(change.operationType) || !("fullDocument" in change)) return;
  const doc = change.fullDocument;
  if (!doc || doc.isDeleted) return;
  const fields = change.operationType === "update" ? change.updateDescription.updatedFields ?? {} : doc;
  if ([SupportTicket.collection.collectionName, Complaint.collection.collectionName].includes(change.ns.coll)) {
    await publishCaseChange(change, doc, fields);
    return;
  }
  const orderEvent = change.ns.coll === Order.collection.collectionName;
  const orderId = orderEvent ? doc._id : doc.orderId;
  if (!orderId) return;
  const subscription = await AgentOrderSubscription.findOne({ orderId }).lean();
  if (!subscription || (change.wallTime && change.wallTime < subscription.createdAt)) return;
  const order = await Order.findOne({ _id: orderId, customerId: subscription.userId, isDeleted: false })
    .select("orderCode cancellation.refundPolicy").lean();
  if (!order) return;
  let lines: string[] = [];
  if (orderEvent) lines = describeOrderProgress(fields);
  else if (change.ns.coll === Payment.collection.collectionName) {
    if (fields.status === "paid") lines = [doc.paymentType === "inspection_deposit"
      ? "Thanh toán tiền cọc khảo sát đã thành công."
      : doc.paymentType === "remaining" ? "Thanh toán phần còn lại đã thành công." : "Giao dịch thanh toán đã thành công."];
    if (fields.status === "refunded") {
      const refund = doc.metadata?.refund;
      lines = ["Giao dịch đã được hoàn tiền."];
      if (money(refund?.amount)) lines.push(`Số tiền hoàn: ${money(refund.amount)}.`);
      if (doc.method === "wallet" || refund?.destination === "handigo_wallet") lines.push("Nơi nhận tiền: ví Handigo.");
      if (refund?.destination === "source_account") lines.push("Nơi nhận tiền: tài khoản nguồn thanh toán.");
    }
    if (fields.status === "failed") lines = ["Giao dịch thanh toán đã thất bại hoặc hết hạn. Vui lòng kiểm tra thanh toán trong chi tiết đơn hàng."];
    if (change.operationType === "insert" && doc.status === "pending") lines = [doc.method === "cash"
      ? "Đã ghi nhận phương thức tiền mặt. Bạn thanh toán trực tiếp cho nhà cung cấp sau khi sử dụng dịch vụ."
      : "Giao dịch thanh toán đang chờ xử lý. Mình sẽ thông báo khi có kết quả."];
  } else if (change.ns.coll === Refund.collection.collectionName) {
    if (String(doc.customerId) !== subscription.userId) return;
    lines = describeRefundProgress(doc, fields.status);
    if (!lines.length) return;
    const policy = order.cancellation?.refundPolicy;
    if (policy && fields.status === "requested") {
      lines.push(`Đã thanh toán: ${money(policy.paidAmount)}. Phí hủy: ${money(policy.cancellationFee)}.`);
    }
    const stage = ["requesting", "pending"].includes(String(fields.status)) ? "processing" : String(fields.status);
    await deliver(subscription, `order-event:refund:${doc._id}:${stage}`,
      `Cập nhật hoàn tiền đơn ${order.orderCode}:\n${lines.join("\n")}`, change.wallTime ?? new Date());
    return;
  } else if (change.ns.coll === RepairQuotation.collection.collectionName) {
    const labels: Record<string, string> = { pending: "Có báo giá mới đang chờ bạn xác nhận.",
      approved: "Báo giá đã được chấp nhận.", rejected: "Báo giá đã bị từ chối.",
      expired: "Báo giá đã hết hạn.", cancelled: "Báo giá đã được hủy." };
    if (typeof fields.status === "string" && labels[fields.status]) lines = [labels[fields.status]];
  }
  if (!lines.length) return;
  const id = `order-event:${createHash("sha256").update(JSON.stringify(change._id)).digest("hex")}`;
  await deliver(subscription, id, `Cập nhật đơn ${order.orderCode}:\n${lines.join("\n")}`, change.wallTime ?? new Date());
}

let stream: ChangeStream<Document> | null = null;
let running = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let registrationTimer: ReturnType<typeof setInterval> | null = null;
let restoring = false;

function snapshotChange(collection: string, doc: Document): ChangeStreamDocument<Document> {
  return {
    _id: { _data: `recovery:${collection}:${doc._id}:${new Date(doc.updatedAt).toISOString()}` },
    operationType: "replace", ns: { db: "", coll: collection },
    fullDocument: doc, wallTime: new Date(),
  } as unknown as ChangeStreamDocument<Document>;
}

async function recoverOrderDetails(userId: string, orderId: string) {
  const refunds = await Refund.find({ orderId, customerId: userId, isDeleted: false }).lean();
  for (const refund of refunds) await publishAgentOrderChange(snapshotChange(Refund.collection.collectionName, refund));
  const tickets = await SupportTicket.find({ orderId, requesterId: userId, isDeleted: false }).lean();
  for (const ticket of tickets) await publishAgentOrderChange(snapshotChange(SupportTicket.collection.collectionName, ticket));
  const complaints = await Complaint.find({ orderId, complainantId: userId, complainantRole: "CUSTOMER", isDeleted: false }).lean();
  for (const complaint of complaints) await publishAgentOrderChange(snapshotChange(Complaint.collection.collectionName, complaint));
}

async function restoreSavedTracking() {
  if (restoring || !running) return;
  restoring = true;
  try {
    // Kết quả thành công trong checkpoint là nguồn bền vững để thử lại sau restart.
    const sessions = mongoose.models.AiAgentSession;
    if (!sessions) return;
    for await (const document of sessions.find({ "data.actions": { $elemMatch: {
      tool: { $in: ["create_booking", "create_support_ticket", "create_complaint"] }, status: "SUCCEEDED",
    } } }).select("data").lean().cursor()) {
      if (!running) break;
      await restoreAgentProgressTracking(document.data as AgentSession);
    }
  } catch { logger.warn("Chưa thể khôi phục đăng ký theo dõi; sẽ thử lại ở chu kỳ tiếp theo."); }
  finally { restoring = false; }
}

async function recoverProgress() {
  for await (const subscription of AgentOrderSubscription.find().cursor()) {
    const order = await Order.findOne({ _id: subscription.orderId, customerId: subscription.userId, isDeleted: false }).lean();
    if (!order) continue;
    await deliver(subscription, `order-event:recovery:${order._id}:${order.updatedAt.toISOString()}`,
      `Đã kết nối lại theo dõi đơn ${order.orderCode}. Trạng thái hiện tại:\n${describeOrderProgress(order as unknown as Record<string, unknown>).join("\n")}`,
      new Date());
    await recoverOrderDetails(subscription.userId, String(subscription.orderId));
  }
  for await (const subscription of AgentCaseSubscription.find().cursor()) {
    const item = subscription.kind === "ticket"
      ? await SupportTicket.findOne({ _id: subscription.caseId, requesterId: subscription.userId, isDeleted: false }).lean()
      : await Complaint.findOne({ _id: subscription.caseId, complainantId: subscription.userId, complainantRole: "CUSTOMER", isDeleted: false }).lean();
    if (item) await publishAgentOrderChange(snapshotChange(subscription.kind === "ticket"
      ? SupportTicket.collection.collectionName : Complaint.collection.collectionName, item));
  }
  await AgentOrderCursor.deleteOne({ _id: CURSOR_ID });
}

async function watchProgress() {
  try {
    const db = mongoose.connection.db;
    if (!db || !running) return;
    const cursor = await AgentOrderCursor.findById(CURSOR_ID).lean();
    // Change stream chỉ phát sự kiện sau khi transaction commit, kể cả thanh toán qua webhook.
    const active = db.watch([{ $match: {
      "ns.coll": { $in: [Order.collection.collectionName, Payment.collection.collectionName, RepairQuotation.collection.collectionName,
        Refund.collection.collectionName, SupportTicket.collection.collectionName, Complaint.collection.collectionName] },
      operationType: { $in: ["insert", "update", "replace"] },
    } }], { fullDocument: "updateLookup", ...(cursor ? { resumeAfter: cursor.token as ResumeToken } : {}) });
    stream = active;
    for await (const change of active) {
      if (!running) break;
      await publishAgentOrderChange(change);
      // Lưu cursor sau tin nhắn; phát lại cùng sự kiện không tạo tin nhắn trùng.
      await AgentOrderCursor.updateOne({ _id: CURSOR_ID }, { $set: { token: change._id } },
        { upsert: true, runValidators: true });
    }
  } catch (error) {
    if (running) {
      logger.error("Không thể theo dõi tiến độ đơn của trợ lý; sẽ kết nối lại.", error);
      if (error instanceof Error && "code" in error && [260, 286].includes(Number(error.code))) {
        // Oplog đã hết thời gian lưu: bổ sung trạng thái hiện tại rồi mở luồng mới.
        await recoverProgress().catch((recoveryError: unknown) =>
          logger.error("Chưa thể khôi phục trạng thái đơn của trợ lý.", recoveryError));
      }
    }
  } finally {
    await stream?.close().catch(() => undefined);
    stream = null;
    if (running) {
      retryTimer = setTimeout(() => void watchProgress(), 5000);
      retryTimer.unref();
    }
  }
}

export function startAgentOrderProgressMonitor() {
  if (running) return;
  running = true;
  void restoreSavedTracking();
  registrationTimer = setInterval(() => void restoreSavedTracking(), 30_000);
  registrationTimer.unref();
  void watchProgress();
}

export async function stopAgentOrderProgressMonitor() {
  running = false;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  if (registrationTimer) clearInterval(registrationTimer);
  registrationTimer = null;
  await stream?.close();
}
