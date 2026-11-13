import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { idSchema } from "./booking.schemas";
import { createRescheduleRequestSchema, respondRescheduleRequestSchema } from "../../../validations/order.validator";
import { AgentRescheduleService } from "../../../services/agentReschedule.service";
import { AppError } from "../../../utils/appError";

const order = z.object({ orderId: idSchema }).strict();
const request = order.extend({ requestId: idSchema });
const create = order.extend(createRescheduleRequestSchema.pick({ scheduledAt: true, reason: true }).shape);
const respond = request.extend({ decision: z.enum(["accept", "reject"]), reason: z.string().trim().max(500).optional() })
  .superRefine((value, ctx) => {
    const parsed = respondRescheduleRequestSchema.safeParse({ decision: value.decision, reason: value.reason });
    if (!parsed.success) for (const issue of parsed.error.issues) ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
  });
const actionId = (value?: string) => { if (!value) throw new AppError("Thiếu mã hành động đã xác nhận.", 409); return value; };
const reply = (result: unknown) => ({ state: "COMPLETED" as const, message: (result as { message: string }).message });
export const getBookingRescheduleTool: AgentTool<z.infer<typeof order>> = {
  name: "get_booking_reschedule", description: "Xem lịch hiện tại, điều kiện dời lịch và đề nghị đang chờ của đúng đơn khách hàng. Lấy requestId thật trước khi phản hồi/thu hồi.",
  inputSchema: order, roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
  execute: (ctx, args) => AgentRescheduleService.get(ctx.user, args.orderId),
};
export const requestBookingRescheduleTool: AgentTool<z.infer<typeof create>> = {
  name: "request_booking_reschedule", description: "Đề nghị đổi lịch đơn đã tạo. Cần ngày giờ chính xác kèm múi giờ và lý do khách cung cấp. Hiển thị lịch cũ/mới để xác nhận; có thợ nhận thì phải chờ thợ đồng ý, không báo đã đổi lịch ngay.",
  inputSchema: create, roles: ["CUSTOMER"], mutates: true, requiresConfirmation: true,
  preview: (ctx, args) => AgentRescheduleService.previewCreate(ctx.user, args),
  execute: (ctx, args) => AgentRescheduleService.create(ctx.user, args, ctx.confirmedPreview, actionId(ctx.actionId)),
  reconcile: (ctx, args) => AgentRescheduleService.reconcile(ctx.user, args, actionId(ctx.actionId), "create"), reply,
};
export const respondBookingRescheduleTool: AgentTool<z.infer<typeof respond>> = {
  name: "respond_booking_reschedule", description: "Đồng ý hoặc từ chối lịch mới thợ đề xuất cho đơn của khách. Phải lấy requestId hiện tại; từ chối cần lý do. Chỉ thực hiện sau nút xác nhận riêng.",
  inputSchema: respond, roles: ["CUSTOMER"], mutates: true, requiresConfirmation: true,
  preview: (ctx, args) => AgentRescheduleService.previewResponse(ctx.user, args),
  execute: (ctx, args) => AgentRescheduleService.respond(ctx.user, args, ctx.confirmedPreview),
  reconcile: (ctx, args) => AgentRescheduleService.reconcile(ctx.user, args, actionId(ctx.actionId), "respond"), reply,
};
export const cancelBookingRescheduleTool: AgentTool<z.infer<typeof request>> = {
  name: "cancel_booking_reschedule", description: "Thu hồi đề nghị dời lịch do chính khách gửi và đang chờ. Không hủy đơn. Hiển thị bản xác nhận trước khi thực hiện.",
  inputSchema: request, roles: ["CUSTOMER"], mutates: true, requiresConfirmation: true,
  preview: (ctx, args) => AgentRescheduleService.previewResponse(ctx.user, args, true),
  execute: (ctx, args) => AgentRescheduleService.cancel(ctx.user, args),
  reconcile: (ctx, args) => AgentRescheduleService.reconcile(ctx.user, args, actionId(ctx.actionId), "cancel"), reply,
};
