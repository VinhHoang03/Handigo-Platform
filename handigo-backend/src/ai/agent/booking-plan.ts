import { randomUUID } from "node:crypto";
import { z } from "zod";
import { bookingDraftPatchSchema, type BookingDraft } from "./booking-draft";
import type { AgentSession, PendingAction } from "./agent-state";
import type { ToolContext } from "../tools/tool.interface";
import { AppError } from "../../utils/appError";
import { requireBookingAttachments } from "./booking-attachments";

const seedSchema = bookingDraftPatchSchema.omit({ mode: true, startNew: true });
const itemSchema = z.object({
  label: z.string().trim().min(2, "Tên yêu cầu phải có ít nhất 2 ký tự.").max(120, "Tên yêu cầu tối đa 120 ký tự."),
  request: z.string().trim().min(5, "Mô tả yêu cầu phải có ít nhất 5 ký tự.").max(2000, "Mô tả yêu cầu tối đa 2000 ký tự."),
  seed: seedSchema.optional(),
}).strict();
const target = { planId: z.string().uuid("Mã danh sách không hợp lệ."), revision: z.number().int("Phiên bản danh sách phải là số nguyên.").nonnegative("Phiên bản danh sách không hợp lệ.") };
const planItemId = z.string().uuid("Mã yêu cầu không hợp lệ.");
export const bookingPlanSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("view") }).strict(),
  z.object({ action: z.literal("create"), items: z.array(itemSchema).min(2, "Danh sách cần ít nhất hai yêu cầu.").max(10, "Danh sách tối đa 10 yêu cầu."), includeCurrentDraft: z.boolean().optional() }).strict()
    .refine(value => !value.includeCurrentDraft || !value.items[0]?.seed, "Mục đầu dùng bản nháp hiện tại, không gửi dữ liệu thay thế trong seed."),
  z.object({ action: z.literal("append"), ...target, items: z.array(itemSchema).min(1, "Cần bổ sung ít nhất một yêu cầu.").max(10, "Danh sách tối đa 10 yêu cầu.") }).strict(),
  z.object({ action: z.literal("edit"), ...target, itemId: planItemId, ...itemSchema.shape }).strict(),
  z.object({ action: z.enum(["next", "skip", "defer", "pause", "resume", "cancel"]), ...target, itemId: planItemId.optional() }).strict(),
]);
export type BookingPlanInput = z.infer<typeof bookingPlanSchema>;
export interface BookingPlan {
  id: string; revision: number; sourceRequestId: string; draftRevision?: number;
  status: "active" | "paused" | "completed" | "cancelled";
  activeItemId?: string;
  items: Array<{ id: string; label: string; request: string; seed?: z.infer<typeof seedSchema>; seedApplied?: boolean;
    status: "queued" | "active" | "blocked" | "created" | "skipped"; draft?: BookingDraft; orderId?: string; orderCode?: string }>;
}
export function activeBookingItem(session: AgentSession) {
  return session.bookingPlan?.items.find(item => item.id === session.bookingPlan?.activeItemId);
}
export function bookingPlanView(session: AgentSession) {
  const plan = session.bookingPlan;
  return plan ? { id: plan.id, revision: plan.revision, status: plan.status, activeItemId: plan.activeItemId,
    items: plan.items.map(({ id, label, status, orderId, orderCode }) => ({ id, label, status, orderId, orderCode })),
    note: "Mỗi yêu cầu có bản xác nhận riêng. Đã tạo đơn chưa đồng nghĩa đã trả tiền hoặc có thợ nhận. Bỏ/tạm dừng kế hoạch không hủy các đơn đã tạo." } : null;
}
function activate(session: AgentSession, item: BookingPlan["items"][number]) {
  const plan = session.bookingPlan!;
  plan.draftRevision = Math.max(plan.draftRevision ?? 0, session.bookingDraft?.revision ?? 0, item.draft?.revision ?? 0) + 1;
  item.status = "active"; plan.activeItemId = item.id; plan.status = "active";
  session.bookingDraft = item.draft ? { ...structuredClone(item.draft), status: "active", revision: plan.draftRevision }
    : { revision: plan.draftRevision, status: "active", values: {}, sources: {}, summary: [], missing: [], choiceGroups: [] };
  session.currentGoal = item.request;
  session.taskVersion++;
  session.recovery = undefined; session.lastDraftRequest = undefined;
  session.draftBackup = undefined; session.rebookProposal = undefined;
  session.collectedInformation = {};
}
export function advanceBookingPlan(session: AgentSession): boolean {
  const plan = session.bookingPlan;
  if (!plan || plan.status !== "active" || session.pendingAction || session.requiresReconciliation) return false;
  const current = activeBookingItem(session);
  if (current && !["created", "skipped", "blocked"].includes(current.status)) return false;
  plan.draftRevision = Math.max(plan.draftRevision ?? 0, session.bookingDraft?.revision ?? 0);
  const next = plan.items.find(item => item.status === "queued");
  plan.revision++;
  if (next) { activate(session, next); return true; }
  plan.activeItemId = undefined;
  plan.status = plan.items.some(item => item.status === "blocked") ? "paused" : "completed";
  return false;
}
export function recordPlannedBooking(session: AgentSession, action: PendingAction) {
  const preview = z.object({ bookingPlanId: z.string(), bookingPlanItemId: z.string() }).safeParse(action.preview);
  const order = z.object({ orderId: z.string(), orderCode: z.string() }).safeParse(action.result);
  if (action.tool !== "create_booking" || action.status !== "SUCCEEDED" || !preview.success || !order.success) return;
  const plan = session.bookingPlan;
  const item = plan?.items.find(item => item.id === preview.data.bookingPlanItemId);
  if (!plan || plan.id !== preview.data.bookingPlanId || !item || item.status === "created") return;
  item.status = "created"; item.orderId = order.data.orderId; item.orderCode = order.data.orderCode; item.draft = undefined;
  if (plan.items.every(item => ["created", "skipped"].includes(item.status))) {
    plan.status = "completed"; plan.activeItemId = undefined;
  }
  plan.revision++;
}
export function manageBookingPlan(context: ToolContext, raw: BookingPlanInput) {
  const args = bookingPlanSchema.parse(raw), session = context.session;
  if (!session || context.user.role !== "CUSTOMER" || session.userId !== context.user.id || session.id !== context.sessionId) throw new AppError("Không có quyền quản lý kế hoạch đặt dịch vụ.", 403);
  if (args.action === "view") return bookingPlanView(session);
  if (context.readOnly || session.pendingAction || session.requiresReconciliation
    || session.actions.some(action => ["UNKNOWN", "EXECUTING"].includes(action.status))) throw new AppError("Cần xử lý xác nhận hoặc đối soát trước khi đổi yêu cầu đặt dịch vụ.", 409);
  const previous = session.bookingPlan;
  if (args.action === "create") {
    if (previous?.sourceRequestId === session.activeRequest?.requestId) return bookingPlanView(session);
    if (previous && ["active", "paused"].includes(previous.status)) throw new AppError("Đã có kế hoạch chưa hoàn tất. Hãy bổ sung yêu cầu hoặc xử lý kế hoạch hiện tại.", 409);
    const currentDraft = session.bookingDraft && ["active", "paused"].includes(session.bookingDraft.status) && !session.bookingDraft.orderId ? session.bookingDraft : undefined;
    if (currentDraft && !args.includeCurrentDraft) throw new AppError("Có bản nháp đang soạn. Hãy giữ bản nháp làm mục đầu bằng includeCurrentDraft hoặc hỏi khách trước khi bỏ.", 409);
    if (args.includeCurrentDraft && !currentDraft) throw new AppError("Không còn bản nháp có thể đưa vào danh sách. Hãy tải lại tiến độ.", 409);
    if (!session.activeRequest) throw new AppError("Thiếu yêu cầu của khách để lập kế hoạch.", 409);
    args.items.forEach(item => requireBookingAttachments(session, item.seed?.customerAttachments));
    session.bookingPlan = { id: randomUUID(), revision: 1, sourceRequestId: session.activeRequest.requestId, status: "active",
      items: args.items.map(item => ({ ...item, id: randomUUID(), status: "queued" })) };
    if (currentDraft && args.includeCurrentDraft) {
      session.bookingPlan.items[0].draft = structuredClone(currentDraft);
      session.bookingPlan.items[0].seedApplied = true;
    }
    activate(session, session.bookingPlan.items[0]);
    return bookingPlanView(session);
  }
  const plan = session.bookingPlan;
  if (!plan || plan.id !== args.planId || plan.revision !== args.revision) throw new AppError("Danh sách yêu cầu đã thay đổi. Hãy tải lại trước khi thao tác.", 409);
  if (["completed", "cancelled"].includes(plan.status)) throw new AppError("Kế hoạch đã kết thúc. Hãy tạo yêu cầu đặt mới.", 409);
  if (args.action === "append") {
    if (plan.items.length + args.items.length > 10) throw new AppError("Mỗi kế hoạch tối đa 10 yêu cầu. Hãy hoàn tất kế hoạch hiện tại trước khi đặt thêm.", 400);
    args.items.forEach(item => requireBookingAttachments(session, item.seed?.customerAttachments));
    plan.items.push(...args.items.map(item => ({ ...item, id: randomUUID(), status: "queued" as const })));
  } else {
    const item = "itemId" in args && args.itemId ? plan.items.find(item => item.id === args.itemId) : activeBookingItem(session);
    if ("itemId" in args && args.itemId && !item) throw new AppError("Không tìm thấy yêu cầu trong danh sách hiện tại.", 404);
    if (args.action === "edit") {
      if (!item || !["queued", "blocked"].includes(item.status)) throw new AppError("Chỉ sửa nội dung yêu cầu chưa bắt đầu hoặc đang để lại. Yêu cầu đang soạn dùng công cụ sửa bản nháp.", 409);
      requireBookingAttachments(session, args.seed?.customerAttachments);
      Object.assign(item, { label: args.label, request: args.request, seed: args.seed, seedApplied: false, draft: undefined, status: "queued" });
    } else if (args.action === "cancel") {
      plan.items.forEach(item => { if (item.status !== "created") { item.status = "skipped"; item.draft = undefined; } });
      plan.status = "cancelled"; plan.activeItemId = undefined;
      if (!session.bookingDraft?.orderId) session.bookingDraft = undefined;
      session.recovery = undefined;
    } else if (args.action === "pause") {
      if (item?.status === "active") item.draft = structuredClone(session.bookingDraft);
      if (session.bookingDraft?.status === "active") session.bookingDraft.status = "paused";
      plan.status = "paused";
      session.recovery = undefined;
    } else if (args.action === "skip" || args.action === "defer") {
      if (!item || !["queued", "active", "blocked"].includes(item.status)) throw new AppError("Không thể bỏ hoặc để lại yêu cầu đã tạo đơn.", 409);
      const wasActive = item.id === plan.activeItemId;
      if (wasActive) item.draft = args.action === "defer" ? structuredClone(session.bookingDraft) : undefined;
      item.status = args.action === "skip" ? "skipped" : "blocked";
      if (wasActive) {
        session.recovery = undefined;
        if (plan.status === "paused") {
          plan.draftRevision = Math.max(plan.draftRevision ?? 0, session.bookingDraft?.revision ?? 0);
          plan.activeItemId = undefined; session.bookingDraft = undefined;
        } else if (!advanceBookingPlan(session)) session.bookingDraft = undefined;
      }
    } else if (args.action === "resume") {
      if ("itemId" in args && args.itemId && item && ["created", "skipped"].includes(item.status)) throw new AppError("Yêu cầu này đã tạo đơn hoặc đã bỏ; không thể tiếp tục để tạo lại.", 409);
      const current = activeBookingItem(session);
      const chosen = item && ["active", "blocked", "queued"].includes(item.status) ? item : plan.items.find(item => ["queued", "blocked"].includes(item.status));
      if (!chosen) throw new AppError("Không còn yêu cầu để tiếp tục.", 409);
      if (current?.status === "active" && current.id !== chosen.id) throw new AppError("Hãy tạm để lại yêu cầu đang soạn trước khi chuyển sang yêu cầu khác.", 409);
      if (chosen.id === current?.id && session.bookingDraft && !session.bookingDraft.orderId) chosen.draft = structuredClone(session.bookingDraft);
      activate(session, chosen);
    } else if (args.action === "next") {
      if (plan.status === "paused") throw new AppError("Kế hoạch đang tạm dừng. Hãy chọn tiếp tục trước.", 409);
      if (activeBookingItem(session)?.status === "active") throw new AppError("Hãy xác nhận, bỏ hoặc để lại yêu cầu hiện tại trước khi chuyển tiếp.", 409);
      advanceBookingPlan(session);
    }
  }
  if (plan.status !== "cancelled" && plan.items.every(item => ["created", "skipped"].includes(item.status))) {
    plan.status = "completed"; plan.activeItemId = undefined;
  }
  plan.revision++;
  return bookingPlanView(session);
}
