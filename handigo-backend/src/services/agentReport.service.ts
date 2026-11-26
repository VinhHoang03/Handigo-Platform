import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import { REPORT_TYPES } from "../models/report.model";
import { Conversation } from "../models/conversation.model";
import * as reports from "./report.service";
import { AgentBookingService } from "./agentBooking.service";
import { customerCaseView } from "./agentCustomerCare.service";
import { agentActionResourceId } from "../utils/agentActionResourceId";
import { AppError } from "../utils/appError";
import { idSchema } from "../ai/tools/implementations/booking.schemas";
import { bookingAttachmentsSchema } from "../ai/agent/booking-attachments";

// Không nhận danh tính khách/thợ từ model; báo cáo hành vi gắn với đơn hoặc cuộc trò chuyện đã kiểm tra quyền.
export const agentReportSchema = z.object({
  targetType: z.enum(["order", "chat_conversation", "system", "app"]),
  orderId: idSchema.optional(), conversationId: idSchema.optional(),
  reportType: z.enum(REPORT_TYPES).exclude(["service_quality"]),
  title: z.string().trim().min(5).max(200), description: z.string().trim().min(10).max(3000),
  customerAttachments: bookingAttachmentsSchema.optional(),
}).strict().refine((args) => args.targetType !== "order" || Boolean(args.orderId), "Cần chọn đơn bị báo cáo.")
  .refine((args) => args.targetType !== "chat_conversation" || Boolean(args.conversationId), "Cần chọn cuộc trò chuyện bị báo cáo.")
  .refine((args) => !args.conversationId || args.targetType === "chat_conversation", "Cuộc trò chuyện không phù hợp với đối tượng báo cáo.")
  .refine((args) => !["system", "app"].includes(args.targetType) || !args.orderId, "Báo cáo ứng dụng không gắn với đơn dịch vụ.");
type ReportArgs = z.infer<typeof agentReportSchema>;
const view = (value: Parameters<typeof customerCaseView>[0], detail = false) => {
  const plain = value && typeof value === "object" && "toObject" in value && typeof value.toObject === "function" ? value.toObject() : value;
  const types = z.object({ reportType: z.string(), targetType: z.string() }).parse(plain);
  return { ...customerCaseView(value, detail), ...types };
};
const payload = ({ customerAttachments, ...args }: ReportArgs) => ({ ...args, evidenceImages: customerAttachments ?? [] });

export const AgentReportService = {
  async context(userId: string, orderId: string) {
    const order = await AgentBookingService.getBooking(userId, orderId);
    const conversation = await Conversation.findOne({ orderId, customerId: userId, isDeleted: false }).select("_id").lean();
    return { orderId, orderCode: order.orderCode, conversationId: conversation ? String(conversation._id) : null,
      note: conversation ? "Có thể báo cáo hành vi trên đơn hoặc cuộc trò chuyện này." : "Chưa có cuộc trò chuyện; vẫn có thể báo cáo hành vi gắn với đơn." };
  },
  async preview(userId: string, args: ReportArgs) {
    const parsed = agentReportSchema.parse(args);
    if (parsed.orderId) await AgentBookingService.getBooking(userId, parsed.orderId);
    const target = await reports.resolveReportTarget(userId, "CUSTOMER", payload(parsed));
    const order = target.orderId ? await AgentBookingService.getBooking(userId, String(target.orderId)) : null;
    return { title: "Gửi báo cáo vi phạm", subject: parsed.title, description: parsed.description,
      reportType: parsed.reportType, targetType: parsed.targetType,
      orderCode: order?.orderCode ?? "Không gắn với đơn dịch vụ", customerAttachments: parsed.customerAttachments ?? [],
      note: "Báo cáo được gửi để xem xét, chưa phải kết luận vi phạm hoặc quyết định hoàn tiền." };
  },
  async create(userId: string, args: ReportArgs, sessionId: string, actionId?: string) {
    if (!actionId) throw new AppError("Thiếu mã hành động đã xác nhận.", 409);
    await this.preview(userId, args);
    return view(await reports.createReport(userId, "CUSTOMER", payload(args), agentActionResourceId(userId, sessionId, actionId)), true);
  },
  async list(userId: string, query: Parameters<typeof reports.getMyReports>[1]) {
    const result = await reports.getMyReports(userId, query);
    return { items: result.items.map((item) => view(item)), pagination: result.pagination };
  },
  async detail(userId: string, reportId: string) { return view(await reports.getReportForUser(userId, reportId), true); },
  async previewAction(userId: string, reportId: string, images?: string[], note?: string) {
    const item = await reports.getReportForUser(userId, reportId);
    if (reports.REPORT_TERMINAL_STATUSES.includes(item.status) || item.isCustomerNoShow) throw new AppError("Báo cáo đã kết thúc hoặc thuộc quy trình xác minh riêng.", 409);
    if (images && !images.length) throw new AppError("Vui lòng tải ít nhất một ảnh bằng chứng.", 400);
    return { title: images ? "Bổ sung bằng chứng báo cáo" : "Hủy báo cáo", caseId: String(item._id),
      subject: item.title, caseStatus: item.status, description: note ?? (images ? "Gửi bổ sung ảnh bằng chứng." : "Hủy báo cáo này. Thao tác không thể hoàn tác."),
      ...(images ? { customerAttachments: images } : {}) };
  },
  async cancel(userId: string, reportId: string) { return view(await reports.cancelReport(userId, reportId), true); },
  async evidence(userId: string, reportId: string, images: string[], note?: string) {
    return view(await reports.addReportEvidence(userId, "CUSTOMER", reportId, { files: images.map((url) => ({ fileType: "image", url })), note }), true);
  },
  async reconcileCreated(userId: string, sessionId: string, actionId?: string) {
    if (!actionId) return null;
    try { return await this.detail(userId, String(agentActionResourceId(userId, sessionId, actionId))); }
    catch (error) { if (error instanceof AppError && error.statusCode === 404) return null; throw error; }
  },
  async reconcileCancel(userId: string, reportId: string) {
    const item = await reports.getReportForUser(userId, reportId);
    return item.status === "cancelled" ? view(item, true) : null;
  },
  async reconcileEvidence(userId: string, reportId: string, images: string[], note?: string, startedAt?: string) {
    if (!images.length || !Number.isFinite(Date.parse(startedAt ?? ""))) return null;
    const item = await reports.getReportForUser(userId, reportId);
    const matches = images.every((url) => item.evidenceFiles.some((file) =>
      String(file.uploadedBy?._id ?? file.uploadedBy) === userId && file.fileType === "image" && file.url === url
      && isDeepStrictEqual(file.note ?? "", note ?? "") && file.uploadedAt.getTime() >= Date.parse(startedAt!)));
    return matches ? view(item, true) : null;
  },
};
