import { createHash } from "node:crypto";
import type { ClientSession, Model } from "mongoose";
import { ProviderApplication } from "../../models/providerApplication.model";
import { ServiceSuggestion } from "../../models/serviceSuggestion.model";
import { Complaint } from "../../models/complaint.model";
import { Report } from "../../models/report.model";
import { SupportTicket } from "../../models/supportTicket.model";
import { Service } from "../../models/service.model";
import { Category } from "../../models/category.model";
import { Order } from "../../models/order.model";
import { Conversation } from "../../models/conversation.model";
import { Message } from "../../models/message.model";
import { ComplaintEvidence } from "../../models/complaintEvidence.model";
import { Payment } from "../../models/payment.model";
import { customerKnowledge } from "../knowledge/customer-knowledge";
import { AppError } from "../../utils/appError";
import type { AISource } from "./admin-ai.provider";
import type { RunInput } from "./admin-ai.validation";
import { loadComplaintDetails } from "./admin-ai.complaint-context";

export type SourceRow = Record<string, unknown> & { _id: import("mongoose").Types.ObjectId; updatedAt?: Date; status?: string };
export const hashSource = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function sourceModel(type: string): Model<SourceRow> {
  const models = { provider_application: ProviderApplication, service_suggestion: ServiceSuggestion, complaint: Complaint, report: Report, support_ticket: SupportTicket };
  const selected = models[type as keyof typeof models];
  if (!selected) throw new AppError("Loại tài nguyên AI không hợp lệ.", 400);
  return selected as unknown as Model<SourceRow>;
}
export const privateText = (value: unknown) => String(value ?? "").replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[đã che email]").replace(/\b(?:\+?\d[\d .-]{8,}\d)\b/g, text => /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(text) ? text : "[đã che số định danh]").slice(0, 6000);
const source = (id: string, data: unknown): AISource => ({ id, text: JSON.stringify(data, (_key, value) => typeof value === "string" ? privateText(value) : value).slice(0, 6000) });
export async function loadContext(input: Pick<RunInput, "sourceType" | "sourceId" | "from" | "to">, session?: ClientSession) {
  if (input.sourceType === "operations") throw new AppError("Báo cáo vận hành AI đã được ngừng sử dụng.", 410);
  const row = await sourceModel(input.sourceType).findOne({ _id: input.sourceId, isDeleted: false, ...(input.sourceType === "provider_application" ? { status: { $ne: "draft" } } : {}) }).session(session ?? null).lean();
  if (!row) throw new AppError("Không tìm thấy tài nguyên cần phân tích AI.", 404);
  const sources: AISource[] = [];
  let catalogComplete = true;
  let complaintFingerprint: unknown = null;
  const imageUrls = new Set<string>();
  const addImages = (urls: unknown[], label: string) => {
    for (const url of urls) if (typeof url === "string" && url && !imageUrls.has(url)) {
      if (imageUrls.size >= 80) { catalogComplete = false; continue; }
      imageUrls.add(url);
      sources.push({ id: `image:${imageUrls.size}`, text: label, imageUrl: url });
    }
  };
  if (input.sourceType === "provider_application") {
    const services = await Service.find({ _id: { $in: (row.serviceIds as unknown[] || []).map(String) }, isDeleted: false, isActive: true }).select("name categoryId").session(session ?? null).lean();
    const certificates = row.certificates as Array<Record<string, unknown>> || [];
    const identity = (row.identityDocument || {}) as Record<string, unknown>;
    addImages([identity.frontImageUrl], "Mặt trước giấy tờ trong hồ sơ thợ.");
    addImages([identity.backImageUrl], "Mặt sau giấy tờ trong hồ sơ thợ.");
    addImages([identity.passportImageUrl], "Ảnh hộ chiếu trong hồ sơ thợ.");
    addImages([identity.selfieImageUrl], "Ảnh chân dung trong hồ sơ thợ; không xác thực danh tính.");
    for (const [index, certificate] of certificates.entries()) addImages((certificate.imageUrls || []) as unknown[], `Ảnh chứng chỉ thứ ${index + 1}; đối chiếu với chứng chỉ đã khai.`);
    sources.push(source(`provider_application:${row._id}`, { description: row.description, experienceYears: row.experienceYears, identityDeclared: { type: identity.type, issuedAt: identity.issuedAt, expiresAt: identity.expiresAt }, applicationType: row.applicationType, status: row.status, createdAt: row.createdAt, updatedAt: row.updatedAt, certificates: certificates.map(item => ({ title: item.title, issuer: item.issuer, description: item.description, issuedAt: item.issuedAt, expiresAt: item.expiresAt, hasImages: Array.isArray(item.imageUrls) && item.imageUrls.length > 0 })), services: services.map(item => ({ id: String(item._id), name: item.name })) }));
    catalogComplete = services.length === (row.serviceIds as unknown[] || []).length;
  } else if (input.sourceType === "service_suggestion") {
    const [services, categories] = await Promise.all([
      Service.find({ isDeleted: false }).select("name categoryId description").sort({ _id: 1 }).limit(501).session(session ?? null).lean(),
      Category.find({ isDeleted: false }).select("name isActive").sort({ _id: 1 }).limit(201).session(session ?? null).lean(),
    ]);
    catalogComplete = services.length <= 500 && categories.length <= 200;
    sources.push(source(`service_suggestion:${row._id}`, { name: row.suggestedServiceName, categoryName: row.suggestedCategoryName, categoryId: row.categoryId, description: row.description, suggestionType: row.suggestionType, status: row.status }));
    for (const item of services.slice(0, 500)) sources.push(source(`service:${item._id}`, { name: item.name, categoryId: item.categoryId, description: item.description }));
    for (const item of categories.slice(0, 200)) sources.push(source(`category:${item._id}`, { name: item.name, isActive: item.isActive }));
  } else {
    sources.push(source(`${input.sourceType}:${row._id}`, { title: row.title ?? row.subject, description: row.description, status: row.status, reportType: row.reportType, targetType: row.targetType, reporterRole: row.reporterRole, isCustomerNoShow: row.isCustomerNoShow, hasViolation: Boolean(row.createdViolationId), category: row.category, priority: row.priority, createdAt: row.createdAt, updatedAt: row.updatedAt, requestedEvidenceNote: row.requestedEvidenceNote, reviewNote: row.reviewNote, resolutionNote: row.resolutionNote, attachmentsNotAnalyzed: true }));
    if (["complaint", "report"].includes(input.sourceType)) {
      const details = await loadComplaintDetails(row, session);
      complaintFingerprint = details.records;
      for (const record of details.records) sources.push(source(record.id, record.data));
      catalogComplete = details.complete;
      const files: Array<{ url?: unknown; fileType?: unknown; fileName?: unknown; mimeType?: unknown; note?: unknown; uploadedAt?: unknown; createdAt?: unknown }> = input.sourceType === "complaint"
        ? await ComplaintEvidence.find({ complaintId: row._id, isDeleted: false }).select("url fileType fileName mimeType note createdAt").sort({ createdAt: 1, _id: 1 }).limit(51).session(session ?? null).lean()
        : (row.evidenceFiles || []) as Array<Record<string, unknown>>;
      const images = (row.evidenceImages || []) as string[];
      addImages(images, "Ảnh bằng chứng do người gửi khiếu nại cung cấp.");
      addImages(files.filter(file => file.fileType === "image").map(file => file.url), "Ảnh tài liệu/hóa đơn đính kèm khiếu nại.");
      sources.push(source("evidence_inventory", { imageCount: images.length, fileCount: files.length, unsupportedFileCount: files.filter(file => file.fileType !== "image").length, attachmentsNotAnalyzed: true, note: "Ảnh được phân tích riêng trong imageAnalyses; video, PDF và tệp khác cần Admin đọc bản gốc. Ảnh không tự chứng minh tính thật của sự việc." }));
      for (const [index, file] of files.slice(0, 50).entries()) sources.push(source(`attachment:${index}`, { fileType: file.fileType, fileName: file.fileName, mimeType: file.mimeType, note: file.note, uploadedAt: file.uploadedAt ?? file.createdAt, contentNotAnalyzed: true }));
      if (files.length > 50) catalogComplete = false;
      for (const [index, article] of customerKnowledge.filter(item => ["complaint", "cancellation", "payment"].includes(item.topic)).entries()) sources.push(source(`policy:${index}`, { title: article.title, content: article.content, source: article.source }));
      sources.push(source("policy:warranty", { note: "Chưa có nguồn chính sách bảo hành được xác minh trong hệ thống. Không suy diễn thời hạn bảo hành, quyền hoàn tiền hoặc bồi thường." }));
    }
    if (input.sourceType === "support_ticket") for (const [index, response] of ((row.responses || []) as Array<Record<string, unknown>>).entries()) sources.push(source(`response:${index}`, { message: response.message, role: response.responderRole, respondedAt: response.respondedAt }));
    if (row.orderId) {
      const resolutionContext = ["complaint", "report"].includes(input.sourceType);
      const order = await Order.findOne({ _id: row.orderId, isDeleted: false }).select(`orderCode status paymentStatus createdAt updatedAt scheduledAt cancellation.reason cancellation.cancelledAt${resolutionContext ? " customerId serviceId inspectionRequired selectedOptionsSnapshot pricing depositAmount depositPaidAt completionNote customerAttachments completionEvidenceImages cancellation.refundPolicy bookingStatus arrival.arrivedAt confirmation" : ""}`).session(session ?? null).lean();
      if (order) {
        const { customerAttachments, completionEvidenceImages, ...orderData } = order;
        sources.push(source(`order:${order._id}`, { ...orderData, customerId: undefined }));
        if (resolutionContext) {
          addImages(customerAttachments || [], "Ảnh hiện trạng khách gửi khi đặt đơn.");
          addImages(completionEvidenceImages || [], "Ảnh hoàn thành do thợ gửi trên đơn hàng.");
          sources.push(source("order_evidence_inventory", { imageCount: (customerAttachments?.length || 0) + (completionEvidenceImages?.length || 0), attachmentsNotAnalyzed: true }));
        }
      }
      if (resolutionContext && order) {
        if (order.cancellation?.refundPolicy) sources.push(source("policy:order_refund", { scope: "Quyết định hoàn tiền khi hủy đơn đã lưu, không phải quyền hoàn tiền khiếu nại.", ...order.cancellation.refundPolicy }));
        const payments = await Payment.find({ orderId: row.orderId, customerId: order.customerId ?? null, isDeleted: false }).select("amount method paymentType status paidAt refundedAt refundReason updatedAt").sort({ createdAt: -1, _id: -1 }).limit(51).session(session ?? null).lean();
        complaintFingerprint = { details: complaintFingerprint, payments };
        for (const payment of payments.slice(0, 50)) sources.push(source(`payment:${payment._id}`, payment));
        sources.push(source("payment_inventory", { count: payments.length, invoiceContentAvailable: false, note: "Giao dịch trong hệ thống không thay thế hóa đơn của thợ; chưa xác minh nội dung hóa đơn đính kèm." }));
        if (payments.length > 50) catalogComplete = false;
      }
      const conversation = await Conversation.findOne({ orderId: row.orderId, isDeleted: false }).session(session ?? null).lean();
      if (conversation) {
        const messages = await Message.find({ conversationId: conversation._id, isDeleted: false }).select("senderRole content messageType createdAt").sort({ createdAt: -1, _id: -1 }).limit(101).session(session ?? null).lean();
        for (const message of messages.slice(0, 100).reverse()) sources.push(source(`message:${message._id}`, { role: message.senderRole, content: message.content, type: message.messageType, createdAt: message.createdAt }));
        if (messages.length > 100) {
          sources.push(source("context_limit", { note: "Chỉ lấy 100 tin nhắn gần nhất; lịch sử trước đó chưa được phân tích." }));
          catalogComplete = false;
        }
      }
    }
  }
  return { row, sources, hash: hashSource({ row, sources, ...(complaintFingerprint ? { complaintFingerprint } : {}) }), catalogComplete: catalogComplete && sources.every(item => item.text.length < 6000), metrics: null as Record<string, unknown> | null };
}
