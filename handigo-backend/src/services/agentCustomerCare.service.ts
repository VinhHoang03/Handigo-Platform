import { z } from "zod";
import * as tickets from "./supportTicket.service";
import * as complaints from "./complaint.service";
import { AgentBookingService } from "./agentBooking.service";
import { AppError } from "../utils/appError";
import { safelyTrackAgentCase } from "./agentOrderProgress.service";
import { createSupportTicketSchema, addSupportTicketResponseSchema } from "../validations/supportTicket.validator";
import { createComplaintSchema } from "../validations/complaint.validator";
import { bookingAttachmentsSchema } from "../ai/agent/booking-attachments";

// Công cụ chỉ nhận ảnh đã được xác thực tại phiên chat, không nhận cấu trúc tệp do LLM tự tạo.
export const agentTicketSchema = createSupportTicketSchema.omit({ attachments: true }).extend({ customerAttachments: bookingAttachmentsSchema.optional() }).strict();
export const agentComplaintSchema = createComplaintSchema.omit({ evidenceImages: true }).extend({ customerAttachments: bookingAttachmentsSchema.optional() }).strict();
export const agentResponseSchema = addSupportTicketResponseSchema.omit({ attachments: true }).extend({ customerAttachments: bookingAttachmentsSchema.optional() }).strict();
const imageFiles = (urls: string[] = []) => urls.map((url) => ({ fileType: "image" as const, url }));

const categoryLabels: Record<string, string> = {
  ACCOUNT: "Tài khoản", PAYMENT: "Thanh toán", ORDER: "Đơn dịch vụ", TECHNICAL: "Kỹ thuật",
  SECURITY: "Bảo mật", APPEAL: "Khiếu nại quyết định", OTHER: "Khác",
};
const priorityLabels: Record<string, string> = { LOW: "Thấp", MEDIUM: "Trung bình", HIGH: "Cao", URGENT: "Khẩn cấp" };
const statusLabels: Record<string, string> = {
  open: "Mới tiếp nhận", in_progress: "Đang xử lý", waiting_user: "Chờ khách phản hồi",
  resolved: "Đã xử lý", closed: "Đã đóng", cancelled: "Đã hủy", pending: "Chờ xem xét",
  evidence_requested: "Cần bổ sung bằng chứng", under_review: "Đang xem xét", rejected: "Đã từ chối",
};
const referenceSchema = z.object({ _id: z.unknown(), orderCode: z.string() }).nullable().optional();
const caseSchema = z.object({
  _id: z.unknown(), orderId: referenceSchema, status: z.string(), createdAt: z.date(),
  subject: z.string().optional(), title: z.string().optional(), description: z.string(),
  category: z.string().optional(), priority: z.string().optional(),
  resolutionNote: z.string().nullable().optional(), requestedEvidenceNote: z.string().nullable().optional(),
});
const responsesSchema = z.object({ responses: z.array(z.object({
  responderRole: z.enum(["USER", "ADMIN"]), message: z.string(), respondedAt: z.date(),
})) });

function plain(value: unknown): unknown {
  if (value && typeof value === "object" && "toObject" in value && typeof value.toObject === "function") return value.toObject();
  return value;
}

// Chỉ đưa nội dung customer được xem vào ngữ cảnh AI, không chuyển hồ sơ người xử lý.
export function customerCaseView(value: unknown, detail = false) {
  const item = caseSchema.parse(plain(value));
  return {
    id: String(item._id), title: item.subject ?? item.title, status: item.status,
    statusLabel: statusLabels[item.status] ?? item.status, createdAt: item.createdAt.toISOString(),
    orderId: item.orderId ? String(item.orderId._id) : null, orderCode: item.orderId?.orderCode ?? null,
    category: item.category ? categoryLabels[item.category] : undefined,
    priority: item.priority ? priorityLabels[item.priority] : undefined,
    ...(detail ? { description: item.description, resolutionNote: item.resolutionNote,
      requestedEvidenceNote: item.requestedEvidenceNote } : {}),
    path: "/customer/support",
  };
}

export const AgentCustomerCareService = {
  async previewTicket(userId: string, args: z.infer<typeof agentTicketSchema>) {
    const order = args.orderId ? await AgentBookingService.getBooking(userId, args.orderId) : null;
    return { title: "Gửi yêu cầu hỗ trợ", subject: args.subject, description: args.description,
      category: categoryLabels[args.category], priority: priorityLabels[args.priority ?? "MEDIUM"],
      orderCode: order?.orderCode ?? "Không gắn với đơn dịch vụ",
      customerAttachments: args.customerAttachments ?? [],
      note: "Yêu cầu được gửi tới bộ phận hỗ trợ. Đây chưa phải kết quả xử lý." };
  },
  async createTicket(userId: string, args: z.infer<typeof agentTicketSchema>, sessionId?: string) {
    const { customerAttachments, ...payload } = args;
    const result = customerCaseView(await tickets.createSupportTicket(userId, "CUSTOMER", { ...payload, attachments: imageFiles(customerAttachments) }), true);
    if (sessionId) void safelyTrackAgentCase(userId, sessionId, result.id, "ticket");
    return result;
  },
  async listTickets(userId: string, query: Parameters<typeof tickets.getMySupportTickets>[1]) {
    const result = await tickets.getMySupportTickets(userId, query);
    return { items: result.items.map((item) => customerCaseView(item)), pagination: result.pagination };
  },
  async ticket(userId: string, ticketId: string, responsePage = 1) {
    const item = await tickets.getSupportTicketForUser(userId, ticketId);
    const responses = responsesSchema.parse(plain(item)).responses;
    const end = Math.max(0, responses.length - (responsePage - 1) * 2);
    return { ...customerCaseView(item, true), responses: responses.slice(Math.max(0, end - 2), end),
      responsePagination: { page: responsePage, total: responses.length, totalPages: Math.ceil(responses.length / 2), note: "Trang 1 là các phản hồi mới nhất." } };
  },
  async previewTicketAction(userId: string, ticketId: string, message?: string, customerAttachments: string[] = []) {
    const ticket = await tickets.getSupportTicketForUser(userId, ticketId);
    if (["resolved", "closed", "cancelled"].includes(ticket.status)) throw new AppError("Yêu cầu hỗ trợ đã kết thúc.", 400);
    return { title: message ? "Gửi phản hồi hỗ trợ" : "Hủy yêu cầu hỗ trợ", caseId: String(ticket._id),
      subject: ticket.subject, description: message ?? "Hủy yêu cầu hỗ trợ này. Thao tác không thể hoàn tác.",
      caseStatus: statusLabels[ticket.status], ...(message !== undefined ? { customerAttachments } : {}) };
  },
  async respond(userId: string, ticketId: string, message: string, customerAttachments: string[] = []) {
    return customerCaseView(await tickets.addSupportTicketResponse(userId, "CUSTOMER", ticketId, { message, attachments: imageFiles(customerAttachments) }));
  },
  async cancelTicket(userId: string, ticketId: string) {
    return customerCaseView(await tickets.cancelSupportTicket(userId, ticketId));
  },
  async previewComplaint(userId: string, args: z.infer<typeof agentComplaintSchema>) {
    const { order } = await complaints.getComplaintCreationContext(userId, "CUSTOMER", args.orderId);
    return { title: "Gửi khiếu nại dịch vụ", subject: args.title, description: args.description,
      orderCode: order.orderCode, customerAttachments: args.customerAttachments ?? [], note: "Khiếu nại và ảnh đính kèm sẽ được xem xét, chưa có quyết định hoàn tiền." };
  },
  async createComplaint(userId: string, args: z.infer<typeof agentComplaintSchema>, sessionId?: string) {
    const { customerAttachments, ...payload } = args;
    const result = customerCaseView(await complaints.createComplaint(userId, "CUSTOMER", { ...payload, evidenceImages: customerAttachments }), true);
    if (sessionId) void safelyTrackAgentCase(userId, sessionId, result.id, "complaint");
    return result;
  },
  async listComplaints(userId: string, query: Parameters<typeof complaints.getMyComplaints>[1]) {
    const result = await complaints.getMyComplaints(userId, query);
    return { items: result.items.map((item) => customerCaseView(item)), pagination: result.pagination };
  },
  async complaint(userId: string, complaintId: string) {
    return customerCaseView(await complaints.getComplaintForUser(userId, complaintId), true);
  },
  async previewCancelComplaint(userId: string, complaintId: string) {
    const item = await this.complaint(userId, complaintId);
    if (["resolved", "rejected", "cancelled"].includes(item.status)) throw new AppError("Khiếu nại đã kết thúc.", 400);
    return { title: "Hủy khiếu nại", caseId: item.id, subject: item.title, orderCode: item.orderCode,
      caseStatus: item.statusLabel, description: "Hủy khiếu nại này. Thao tác không thể hoàn tác; hệ thống không cho tạo khiếu nại khác cho cùng đơn." };
  },
  async cancelComplaint(userId: string, complaintId: string) {
    return customerCaseView(await complaints.cancelComplaint(userId, complaintId));
  },
  async previewEvidence(userId: string, complaintId: string, customerAttachments: string[], note?: string) {
    const item = await this.complaint(userId, complaintId);
    if (["resolved", "rejected", "cancelled"].includes(item.status)) throw new AppError("Khiếu nại đã kết thúc, không thể bổ sung bằng chứng.", 400);
    if (!customerAttachments.length) throw new AppError("Vui lòng tải ít nhất một ảnh bằng chứng.", 400);
    return { title: "Bổ sung bằng chứng khiếu nại", caseId: item.id, subject: item.title, orderCode: item.orderCode,
      caseStatus: item.statusLabel, description: note ?? "Bổ sung ảnh bằng chứng cho khiếu nại này.", customerAttachments };
  },
  async addEvidence(userId: string, complaintId: string, customerAttachments: string[], note?: string) {
    return customerCaseView(await complaints.addComplaintEvidence(userId, "CUSTOMER", complaintId, { files: imageFiles(customerAttachments), note }), true);
  },
};
