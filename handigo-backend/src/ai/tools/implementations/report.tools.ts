import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { AgentReportService as reports, agentReportSchema } from "../../../services/agentReport.service";
import { reportListQuerySchema } from "../../../validations/report.validator";
import { idSchema } from "./booking.schemas";
import { agentRequestAttachments, bookingAttachmentsSchema } from "../../agent/booking-attachments";
import { receipt } from "./customer-care.reply";

const id = z.object({ reportId: idSchema }).strict();
const evidence = id.extend({ customerAttachments: bookingAttachmentsSchema.optional(), note: z.string().trim().max(1000).optional() });
const list = reportListQuerySchema.omit({ limit: true, keyword: true }).strict();
export const getReportContextTool: AgentTool<{ orderId: string }> = {
  name: "get_report_context", description: "Lấy mã đơn và ID cuộc trò chuyện hiện có thuộc chính khách để báo cáo hành vi. Không tạo cuộc trò chuyện hoặc lấy tin nhắn.",
  inputSchema: z.object({ orderId: idSchema }).strict(), roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
  execute: (ctx, args) => reports.context(ctx.user.id, args.orderId),
};
export const createReportTool: AgentTool<z.infer<typeof agentReportSchema>> = {
  name: "create_report", description: "Báo cáo quấy rối, lừa đảo, xúc phạm, spam, thanh toán ngoài hệ thống hoặc lỗi ứng dụng. Gắn đúng đơn/cuộc trò chuyện thuộc khách; dùng get_report_context lấy ID. Không yêu cầu đơn hoàn thành cho báo cáo hành vi. Chất lượng dịch vụ dùng create_complaint. Cần xác nhận nội dung và ảnh.",
  inputSchema: agentReportSchema, roles: ["CUSTOMER"], mutates: true, requiresConfirmation: true,
  preview: (ctx, args) => reports.preview(ctx.user.id, { ...args, customerAttachments: agentRequestAttachments(ctx.session, args.customerAttachments) }),
  execute: (ctx, args) => reports.create(ctx.user.id, { ...args, customerAttachments: agentRequestAttachments(ctx.session, args.customerAttachments) }, ctx.sessionId, ctx.actionId),
  reconcile: (ctx) => reports.reconcileCreated(ctx.user.id, ctx.sessionId, ctx.actionId), reply: receipt("Đã gửi báo cáo để xem xét; chưa có kết luận vi phạm hoặc hoàn tiền."),
};
export const getMyReportsTool: AgentTool<z.infer<typeof list>> = {
  name: "get_my_reports", description: "Tìm báo cáo của chính khách theo trang, trạng thái, loại và đơn. Không đọc báo cáo của người khác.",
  inputSchema: list, roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
  execute: (ctx, args) => reports.list(ctx.user.id, args),
};
export const getReportTool: AgentTool<z.infer<typeof id>> = {
  name: "get_report", description: "Đọc nội dung, trạng thái, yêu cầu bằng chứng và kết quả báo cáo của chính khách; không trả hồ sơ người xử lý.",
  inputSchema: id, roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
  execute: (ctx, args) => reports.detail(ctx.user.id, args.reportId),
};
export const cancelReportTool: AgentTool<z.infer<typeof id>> = {
  name: "cancel_report", description: "Hủy báo cáo còn mở của khách sau xác nhận; báo cáo kết thúc hoặc thuộc xác minh riêng không thể hủy.",
  inputSchema: id, roles: ["CUSTOMER"], mutates: true, requiresConfirmation: true,
  preview: (ctx, args) => reports.previewAction(ctx.user.id, args.reportId), execute: (ctx, args) => reports.cancel(ctx.user.id, args.reportId),
  reconcile: (ctx, args) => reports.reconcileCancel(ctx.user.id, args.reportId), reply: receipt("Đã hủy báo cáo."),
};
export const addReportEvidenceTool: AgentTool<z.infer<typeof evidence>> = {
  name: "add_report_evidence", description: "Bổ sung ảnh của đúng phiên cho báo cáo còn mở, sau xác nhận. Không sửa quyết định hoặc bổ sung cho hồ sơ đã kết thúc.",
  inputSchema: evidence, roles: ["CUSTOMER"], mutates: true, requiresConfirmation: true,
  preview: (ctx, args) => reports.previewAction(ctx.user.id, args.reportId, agentRequestAttachments(ctx.session, args.customerAttachments), args.note),
  execute: (ctx, args) => reports.evidence(ctx.user.id, args.reportId, agentRequestAttachments(ctx.session, args.customerAttachments), args.note),
  reconcile: (ctx, args) => reports.reconcileEvidence(ctx.user.id, args.reportId, args.customerAttachments ?? [], args.note, ctx.actionCreatedAt),
  reply: receipt("Đã bổ sung bằng chứng cho báo cáo."),
};
