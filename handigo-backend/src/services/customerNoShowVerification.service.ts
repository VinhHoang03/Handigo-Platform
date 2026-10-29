import { ClientSession, Types } from "mongoose";
import { createHash } from "node:crypto";
import cloudinary from "../configs/cloudinary";
import User from "../models/user.model";
import { Address } from "../models/address.model";
import { Location } from "../models/location.model";
import { Conversation } from "../models/conversation.model";
import { Message } from "../models/message.model";
import { IOrder } from "../models/order.model";
import { CustomerNoShowEvidence, ICustomerNoShowEvidence } from "../models/customerNoShowEvidence.model";
import { IReport } from "../models/report.model";
import { analyzeNoShowEvidence, NoShowEvidenceKind } from "../ai/customer-no-show/evidence-agent";
import { AppError } from "../utils/appError";
import { haversineMeters } from "./matching.service";
import { CUSTOMER_NO_SHOW_ARRIVAL_RADIUS_METERS, CUSTOMER_NO_SHOW_WAIT_MINUTES, CUSTOMER_NO_SHOW_SKIP_WAIT_FOR_TESTING,
  CUSTOMER_NO_SHOW_SKIP_DUPLICATE_EVIDENCE_FOR_TESTING } from "../utils/customerNoShow";
import { Order } from "../models/order.model";
import { reverseGeocode } from "./reverseGeocoding.service";
import { createLogger } from "../utils/logger";
import { getNoShowEvidenceTimePrecision, resolveNoShowEvidenceTime } from "../utils/customerNoShowEvidence";

const logger = createLogger("CustomerNoShowAI");

export const NO_SHOW_VERIFICATION_VERSION = "HANDIGO_NO_SHOW_AI_V5";

// Chỉ dùng cho chi tiết báo cáo của quản trị viên; không trả mã băm hoặc dữ liệu tải lên chưa gửi.
export const getAdminNoShowDetails = async (report: IReport) => {
  if (!report.orderId) return null;
  const order = await Order.findOne({ _id: report.orderId._id, "customerNoShow.reportId": report._id, isDeleted: false })
    .select("addressId addressSnapshot arrival customerNoShow.evidenceIds customerId orderType scheduledAt").lean();
  if (!order) return null;
  const [address, evidence, customer] = await Promise.all([
    order.addressSnapshot ?? Address.findOne({ _id: order.addressId, isDeleted: false }).lean(),
    CustomerNoShowEvidence.find({ _id: { $in: order.customerNoShow?.evidenceIds ?? [] }, orderId: order._id,
      providerUserId: report.reporterId._id, isDeleted: false })
      .select("kind url analysis analysisStatus analysisFailure uploadedAt createdAt").lean(),
    order.customerId ? User.findOne({ _id: order.customerId, isDeleted: false }).select("phone").lean() : null,
  ]);
  const arrival = order.arrival;
  const hasArrivalLocation = !!arrival && Number.isFinite(arrival.latitude) && Number.isFinite(arrival.longitude);
  const distanceMeters = hasArrivalLocation && Number.isFinite(address?.latitude) && Number.isFinite(address?.longitude)
    ? haversineMeters(arrival.latitude, arrival.longitude, address!.latitude!, address!.longitude!) : null;
  const checkedAt = report.noShowVerification?.checkedAt ?? report.createdAt ?? new Date();
  const scheduled = !CUSTOMER_NO_SHOW_SKIP_WAIT_FOR_TESTING && ["scheduled", "recurring"].includes(order.orderType)
    ? order.scheduledAt?.getTime() ?? 0 : 0;
  const callComparison = inspectNoShowCalls(evidence, {
    customerPhone: customer?.phone?.trim() || address?.recipientPhone || "",
    waitStartedAt: report.noShowVerification?.checks?.waiting.waitStartedAt?.getTime()
      ?? Math.max(arrival?.arrivedAt.getTime() ?? checkedAt.getTime(), scheduled), now: checkedAt.getTime(),
  });
  let arrivalAddress: string | null = null;
  let attribution: string | null = null;
  if (hasArrivalLocation) {
    try {
      const resolved = await reverseGeocode({ latitude: arrival.latitude, longitude: arrival.longitude });
      arrivalAddress = resolved.fullAddress;
      attribution = resolved.attribution;
    } catch { /* Tra cứu địa chỉ lỗi vẫn hiển thị bằng chứng và khoảng cách từ tọa độ đã lưu. */ }
  }
  let callIndex = 0;
  return {
    callComparison: { ...callComparison, phoneSource: customer?.phone?.trim() ? "customer_account" : "order_recipient",
      skipWaitForTesting: CUSTOMER_NO_SHOW_SKIP_WAIT_FOR_TESTING },
    location: {
      orderAddress: address?.fullAddress ?? null, arrivalAddress, attribution,
      arrivedAt: arrival?.arrivedAt ?? null,
      distanceMeters: distanceMeters === null ? null : Math.round(distanceMeters * 10) / 10,
      withinRadius: distanceMeters === null ? null : distanceMeters <= CUSTOMER_NO_SHOW_ARRIVAL_RADIUS_METERS,
      radiusMeters: CUSTOMER_NO_SHOW_ARRIVAL_RADIUS_METERS,
    },
    evidence: evidence.map((item) => ({ id: String(item._id), kind: item.kind, url: item.url,
      analysisStatus: item.analysisStatus, analysis: item.analysis, analysisFailure: item.analysisFailure ?? null,
      resolvedContactAt: item.analysis ? resolveNoShowEvidenceTime({ occurredAt: item.analysis.contactAt,
        dateLabel: item.analysis.contactDateLabel, time: item.analysis.contactTime }, item.uploadedAt ?? item.createdAt) : null,
      callEvents: (item.analysis?.calls ?? []).map((call) => {
        const comparison = item.kind === "contact" && item.analysis?.imageType === "call" ? callComparison.events[callIndex++] : undefined;
        return { ...call, resolvedAt: resolveNoShowEvidenceTime(call, item.uploadedAt ?? item.createdAt),
          ...(comparison && { eligible: comparison.eligible, failures: comparison.failures, timePrecision: comparison.timePrecision }) };
      }),
    })),
  };
};
const normalizeText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d")
  .toLowerCase().replace(/[^a-z0-9/]+/g, " ").trim().replace(/\s+/g, " ");
const normalizePhone = (value: string) => value.replace(/\D/g, "").replace(/^84(?=\d{9}$)/, "0");

export interface VerificationFacts {
  addressLine: string;
  customerPhone: string;
  waitStartedAt: number;
  now: number;
  locationValid: boolean;
  locationDistanceMeters?: number | null;
  reusedEvidence: boolean;
  customerReplied: boolean;
  providerMessages: Array<{ content?: string | null; createdAt: Date }>;
}

type VerificationEvidence = Pick<ICustomerNoShowEvidence, "kind" | "analysis" | "analysisStatus" | "sha256">
  & { uploadedAt?: Date | null; createdAt?: Date };

// Dùng chung phép đối chiếu cho quyết định tự duyệt và phần chẩn đoán ở admin.
export const inspectNoShowCalls = (evidence: VerificationEvidence[], facts: Pick<VerificationFacts, "customerPhone" | "waitStartedAt" | "now">) => {
  const expectedPhone = normalizePhone(facts.customerPhone);
  const seen = new Set<string>();
  const events = evidence.filter((item) => item.kind === "contact" && item.analysis?.imageType === "call")
    .flatMap((item) => (item.analysis?.calls ?? []).map((call) => {
      const resolvedAt = resolveNoShowEvidenceTime(call, item.uploadedAt ?? item.createdAt);
      const normalizedPhone = normalizePhone(call.phoneNumber ?? "");
      const phoneMatched = /^0\d{9}$/.test(expectedPhone) && normalizedPhone === expectedPhone;
      const timePrecision = getNoShowEvidenceTimePrecision(call);
      const windowStart = timePrecision === "minute" ? Math.floor(facts.waitStartedAt / 60_000) * 60_000 : facts.waitStartedAt;
      const inWindow = resolvedAt !== null && Date.parse(resolvedAt) >= windowStart && Date.parse(resolvedAt) <= facts.now;
      const failures: string[] = [];
      if (!phoneMatched) failures.push(`Số trong ảnh ${normalizedPhone || "không đọc được"} không khớp số đối chiếu ${expectedPhone || "chưa có"}`);
      if (!resolvedAt) failures.push("Không quy đổi được ngày giờ cuộc gọi");
      else if (!inWindow) failures.push(Date.parse(resolvedAt) < windowStart
        ? "Cuộc gọi trước thời gian bắt đầu chờ (ngoài khoảng thời gian đối chiếu)"
        : "Cuộc gọi sau thời điểm xác minh (ngoài khoảng thời gian đối chiếu)");
      if (call.direction !== "outgoing") failures.push("Không xác nhận được đây là cuộc gọi đi");
      if (call.outcome !== "no_answer") failures.push("Không xác nhận được cuộc gọi không được trả lời");
      const key = `${normalizedPhone}:${resolvedAt ? Math.floor(Date.parse(resolvedAt) / 60_000) : ""}`;
      if (!failures.length) {
        if (seen.has(key)) failures.push("Đã tính cuộc gọi tới số này trong cùng phút");
        else seen.add(key);
      }
      return { phoneNumber: call.phoneNumber, normalizedPhone, resolvedAt, phoneMatched, inWindow, timePrecision,
        direction: call.direction, outcome: call.outcome, eligible: !failures.length, failures };
    }));
  return { expectedPhone, waitStartedAt: new Date(facts.waitStartedAt), checkedAt: new Date(facts.now),
    validCount: events.filter((event) => event.eligible).length, events };
};

export const getNoShowCallVerification = (evidence: VerificationEvidence[], facts: Pick<VerificationFacts, "customerPhone" | "waitStartedAt" | "now">) => {
  const comparison = inspectNoShowCalls(evidence, facts);
  const callImages = evidence.filter(item => item.kind === "contact" && item.analysis?.imageType === "call");
  const answered = comparison.events.some(call => call.phoneMatched && call.inWindow && call.outcome === "answered");
  const reasons: string[] = [];
  if (answered) reasons.push("Lịch sử cuộc gọi có kết nối với khách trong thời gian chờ; cần quản trị viên xem xét.");
  if (!callImages.length || comparison.validCount < 3) {
    reasons.push(`Chỉ xác minh được ${comparison.validCount}/3 cuộc gọi đi không được trả lời tới đúng số khách trong thời gian chờ. Cần ảnh lịch sử cuộc gọi, không đếm số gộp hoặc cuộc gọi trùng phút.`);
    for (const [index, event] of comparison.events.entries()) {
      if (event.failures.length && index < 5) reasons.push(`Cuộc gọi ${index + 1}: ${event.failures.join("; ")}.`);
    }
  }
  return { comparison, reasons, checks: { passed: comparison.validCount >= 3 && !answered
    && !callImages.some(item => item.analysis?.contactOutcome === "answered"), validCount: comparison.validCount, requiredCount: 3 } };
};

export const evaluateNoShowEvidence = (
  evidence: VerificationEvidence[],
  facts: VerificationFacts,
): NonNullable<IReport["noShowVerification"]> => {
  const reasons: string[] = [];
  const arrival = evidence.filter((item) => item.kind === "arrival");
  const contact = evidence.filter((item) => item.kind === "contact");
  if (!arrival.length || !contact.length) reasons.push("Chưa đủ hai nhóm ảnh bắt buộc.");
  if (!facts.locationValid) reasons.push("Vị trí hiện tại chưa đủ mới hoặc không khớp địa chỉ đơn.");
  if (!CUSTOMER_NO_SHOW_SKIP_DUPLICATE_EVIDENCE_FOR_TESTING
    && (facts.reusedEvidence || new Set(evidence.map((item) => item.sha256)).size !== evidence.length)) {
    reasons.push("Phát hiện ảnh trùng nội dung tệp hoặc đã được dùng cho đơn khác.");
  }
  if (facts.customerReplied) reasons.push("Khách đã phản hồi trong thời gian chờ; cần quản trị viên xem xét.");
  if (evidence.some((item) => item.analysisStatus !== "analyzed" || !item.analysis)) {
    reasons.push("AI chưa phân tích được toàn bộ bằng chứng; cần kiểm tra thủ công.");
  }
  if (!arrival.some((item) => item.analysis?.imageType === "arrival")) {
    reasons.push("Chưa có ảnh thể hiện địa điểm thợ đã đến; không bắt buộc có biển số nhà hoặc tên đường.");
  }
  const messages = facts.providerMessages.filter((message) => message.content?.trim()
    && message.createdAt.getTime() >= facts.waitStartedAt && message.createdAt.getTime() <= facts.now);
  if (!messages.length) reasons.push("Cần ít nhất một tin nhắn thật của thợ trong hội thoại Handigo của đơn, gửi trong thời gian chờ.");
  if (contact.some((item) => item.analysis && (item.analysis.uncertainties.length > 0
    || !["chat", "call"].includes(item.analysis.imageType)))) {
    reasons.push("Bằng chứng liên hệ chưa rõ hoặc không phải ảnh chat/cuộc gọi; cần quản trị viên xem xét.");
  }
  if (contact.some((item) => item.analysis?.contactOutcome === "answered")) {
    reasons.push("Ảnh liên hệ thể hiện khách đã phản hồi hoặc cuộc gọi đã kết nối.");
  }
  const expectedPhone = normalizePhone(facts.customerPhone);
  const phoneMatches = (phone: string) => /^0\d{9}$/.test(expectedPhone) && normalizePhone(phone) === expectedPhone;
  const duringWait = (timestamp: string | null) => timestamp !== null
    && Date.parse(timestamp) >= facts.waitStartedAt && Date.parse(timestamp) <= facts.now;
  const callVerification = getNoShowCallVerification(evidence, facts);
  const { comparison } = callVerification;
  const chatMatched = contact.some((item) => {
    const analysis = item.analysis;
    if (!analysis || analysis.imageType !== "chat" || analysis.contactOutcome !== "no_response"
      || !analysis.providerMessage?.trim()) return false;
    const phoneMatched = analysis.phoneNumbers.some(phoneMatches);
    if (analysis.phoneNumbers.length && !phoneMatched) return false;
    const contactAt = resolveNoShowEvidenceTime({ occurredAt: analysis.contactAt,
      dateLabel: analysis.contactDateLabel, time: analysis.contactTime }, item.uploadedAt ?? item.createdAt);
    const hasCompleteTime = analysis.contactAt || (analysis.contactDateLabel && analysis.contactTime);
    if (hasCompleteTime && !duringWait(contactAt)) return false;
    const content = normalizeText(analysis.providerMessage);
    const matchesHandigo = content.length > 0 && messages.some((message) => normalizeText(message.content!) === content);
    return matchesHandigo;
  });
  if (!chatMatched) {
    reasons.push("Cần ảnh nhắn tin qua Handigo khớp tin nhắn thật của thợ trong đúng đơn, khách chưa phản hồi.");
  }
  reasons.push(...callVerification.reasons);
  return {
    decision: reasons.length ? "manual_review" : "auto_eligible",
    reasons: reasons.length ? reasons : [`Vị trí trong 200 m, có ảnh địa điểm, ảnh chat khớp tin nhắn Handigo và ${comparison.validCount} cuộc gọi đi không được trả lời tới đúng số khách; chưa ghi nhận khách phản hồi.`],
    checkedAt: new Date(facts.now), policyVersion: NO_SHOW_VERIFICATION_VERSION,
    checks: {
      location: { passed: facts.locationValid, distanceMeters: typeof facts.locationDistanceMeters === "number"
        && Number.isFinite(facts.locationDistanceMeters) ? facts.locationDistanceMeters : null,
        radiusMeters: CUSTOMER_NO_SHOW_ARRIVAL_RADIUS_METERS },
      waiting: { passed: CUSTOMER_NO_SHOW_SKIP_WAIT_FOR_TESTING
        || facts.now - facts.waitStartedAt >= CUSTOMER_NO_SHOW_WAIT_MINUTES * 60_000,
        skippedForTesting: CUSTOMER_NO_SHOW_SKIP_WAIT_FOR_TESTING, waitStartedAt: new Date(facts.waitStartedAt),
        requiredMinutes: CUSTOMER_NO_SHOW_WAIT_MINUTES },
      calls: callVerification.checks,
      chat: { passed: chatMatched && messages.length > 0 && !facts.customerReplied, messageCount: messages.length,
        customerReplied: facts.customerReplied },
    },
  };
};

export const storeNoShowEvidence = async (order: IOrder, userId: string, kind: NoShowEvidenceKind, file: Express.Multer.File) => {
  const uploadedAt = new Date();
  let analysis: ICustomerNoShowEvidence["analysis"] = null;
  let analysisFailure: ICustomerNoShowEvidence["analysisFailure"] = null;
  try { analysis = await analyzeNoShowEvidence(file.buffer, file.mimetype, kind); }
  catch (error) {
    const failure = (error && typeof error === "object" ? error : {}) as {
      status?: unknown; name?: unknown; constructor?: { name?: unknown };
    };
    const errorName = failure.name === "Error" ? failure.constructor?.name : failure.name;
    const httpStatus = typeof failure.status === "number" && Number.isInteger(failure.status)
      && failure.status >= 400 && failure.status <= 599 ? failure.status : null;
    const reason = errorName === "NoShowAIConfigError" ? "Thiếu cấu hình khóa AI trong tiến trình backend"
      : errorName === "ZodError" ? "Kết quả AI không đúng cấu trúc dữ liệu yêu cầu"
      : errorName === "SyntaxError" ? "Kết quả AI không phải JSON hợp lệ"
      : ["AbortError", "TimeoutError", "GoogleGenerativeAIAbortError"].includes(String(errorName)) ? "Yêu cầu AI bị hủy hoặc quá thời gian chờ"
      : httpStatus === 429 ? "Gemini giới hạn lượt gọi hoặc hạn mức"
      : httpStatus === 401 || httpStatus === 403 ? "Gemini từ chối xác thực hoặc quyền truy cập"
      : httpStatus === 404 ? "Không truy cập được model hoặc tài nguyên Gemini"
      : httpStatus === 400 ? "Gemini từ chối yêu cầu phân tích ảnh"
      : httpStatus && httpStatus >= 500 ? "Dịch vụ Gemini gặp lỗi"
      : errorName === "GoogleGenerativeAIResponseError" ? "Gemini trả về phản hồi bị chặn hoặc chưa đầy đủ"
      : errorName === "GoogleGenerativeAIRequestInputError" ? "SDK Gemini không chấp nhận dữ liệu yêu cầu phân tích ảnh"
      : errorName === "GoogleGenerativeAIError" ? "SDK Gemini không nhận được phản hồi hợp lệ; có thể do kết nối hoặc dịch vụ"
      : "Không nhận được kết quả phân tích AI hợp lệ";
    analysisFailure = { reason, httpStatus };
    // Không ghi lỗi gốc: thông báo SDK có thể chứa URL kèm khóa hoặc dữ liệu ảnh.
    logger.warn("Không thể phân tích ảnh bằng chứng; chuyển quản trị viên xem xét.", {
      orderId: String(order._id), kind, httpStatus, reason, elapsedMs: Math.max(0, Date.now() - uploadedAt.getTime()),
    });
  }
  const url = await new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: `handigo/no-show/${userId}/${order._id}`, resource_type: "image" }, (error, result) => {
      if (error || !result) return reject(new AppError("Không thể lưu ảnh bằng chứng. Vui lòng thử lại.", 502));
      resolve(result.secure_url);
    });
    stream.end(file.buffer);
  });
  const evidence = await CustomerNoShowEvidence.create({
    orderId: order._id, providerUserId: userId, kind, url,
    sha256: createHash("sha256").update(file.buffer).digest("hex"),
    analysis, analysisStatus: analysis ? "analyzed" : "unavailable", analysisFailure, uploadedAt,
  });
  return { id: String(evidence._id), url: evidence.url, kind: evidence.kind };
};

export const getNoShowEvidence = async (orderId: Types.ObjectId, userId: string, arrivalIds: string[], contactIds: string[], session?: ClientSession) => {
  const ids = [...arrivalIds, ...contactIds];
  if (!arrivalIds.length || !contactIds.length || ids.length > 5) {
    throw new AppError("Vui lòng gửi từ 2 đến 5 ảnh, đủ ảnh đã đến nơi và ảnh liên hệ khách.", 422);
  }
  const evidence = await CustomerNoShowEvidence.find({
    _id: { $in: ids }, orderId, providerUserId: userId, isDeleted: false,
  }).session(session ?? null);
  if (evidence.length !== ids.length || new Set(ids).size !== ids.length || evidence.some((item) =>
    !((item.kind === "arrival" ? arrivalIds : contactIds).includes(String(item._id))))) {
    throw new AppError("Ảnh bằng chứng không đúng loại, không thuộc đơn của bạn hoặc đã bị trùng. Vui lòng chọn lại.", 422);
  }
  if (!CUSTOMER_NO_SHOW_SKIP_DUPLICATE_EVIDENCE_FOR_TESTING
    && new Set(evidence.map((item) => item.sha256)).size !== evidence.length) {
    throw new AppError("Ảnh đã đến nơi và ảnh liên hệ phải là các ảnh khác nhau.", 422);
  }
  return evidence;
};

export const verifyNoShowEvidence = async (order: IOrder, userId: string, evidence: ICustomerNoShowEvidence[], session?: ClientSession) => {
  const [address, customer, location, conversation, reused] = await Promise.all([
    order.addressSnapshot ?? Address.findOne({ _id: order.addressId, isDeleted: false }).session(session ?? null).lean(),
    User.findOne({ _id: order.customerId, isDeleted: false }).select("phone").session(session ?? null).lean(),
    Location.findOne({ userId, ownerType: "provider", isActive: true, isDeleted: false }).sort({ lastUpdatedAt: -1 }).session(session ?? null).lean(),
    Conversation.findOne({ providerId: order.providerId, customerId: order.customerId, isDeleted: false })
      .sort({ createdAt: 1, _id: 1 }).session(session ?? null).lean(),
    CUSTOMER_NO_SHOW_SKIP_DUPLICATE_EVIDENCE_FOR_TESTING ? false
      : CustomerNoShowEvidence.exists({ sha256: { $in: evidence.map((item) => item.sha256) }, orderId: { $ne: order._id }, isDeleted: false }).session(session ?? null),
  ]);
  const now = Date.now();
  const scheduled = !CUSTOMER_NO_SHOW_SKIP_WAIT_FOR_TESTING && ["scheduled", "recurring"].includes(order.orderType)
    ? order.scheduledAt?.getTime() ?? 0 : 0;
  const waitStartedAt = Math.max(order.arrival?.arrivedAt.getTime() ?? now, scheduled);
  const [messages, reply] = conversation ? await Promise.all([
    Message.find({ conversationId: conversation._id, senderId: userId, senderRole: "provider", messageType: "text", isDeleted: false,
      createdAt: { $gte: new Date(waitStartedAt), $lte: new Date(now) } }).select("content createdAt").sort({ createdAt: -1 }).limit(50).session(session ?? null).lean(),
    // Tin đã xóa vẫn chứng minh khách từng phản hồi; chỉ kiểm tra sự tồn tại, không đọc nội dung.
    Message.exists({ conversationId: conversation._id, senderRole: "customer", createdAt: { $gte: new Date(waitStartedAt), $lte: new Date(now) } }).session(session ?? null),
  ]) : [[], null];
  const coordinates = location?.coordinates.coordinates;
  const age = location ? now - location.lastUpdatedAt.getTime() : Infinity;
  const distanceMeters = coordinates && Number.isFinite(address?.latitude) && Number.isFinite(address?.longitude)
    ? haversineMeters(coordinates[1], coordinates[0], address!.latitude!, address!.longitude!) : null;
  const locationValid = distanceMeters !== null && age >= 0 && age <= 120_000
    && distanceMeters <= CUSTOMER_NO_SHOW_ARRIVAL_RADIUS_METERS;
  return evaluateNoShowEvidence(evidence, {
    addressLine: address?.fullAddress ?? "", customerPhone: customer?.phone?.trim() || address?.recipientPhone || "",
    waitStartedAt, now, locationValid, locationDistanceMeters: distanceMeters, reusedEvidence: !!reused,
    customerReplied: !!reply || !!order.customerNoShow?.customerRepliedAt,
    providerMessages: messages,
  });
};
