import { AgentBookingService } from "../../../services/agentBooking.service";
import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { bookingSchema, type BookingArguments } from "./booking.schemas";
import { requireBookingAttachments } from "../../agent/booking-attachments";
import { getCustomerBookingPolicies } from "../../../services/bookingPolicy.service";
import { activeBookingItem } from "../../agent/booking-plan";
import { AppError } from "../../../utils/appError";
export const createBookingTool: AgentTool<BookingArguments> = {
  name: "create_booking", description: "Tạo đơn đặt ngay hoặc lịch hẹn một lần sau xác nhận, hỗ trợ voucher và chuyên gia ưu tiên đã kiểm tra.",
  inputSchema: bookingSchema, mutates: true, requiresConfirmation: true, roles: ["CUSTOMER"],
  preview: async (context, args) => {
    const plan = context.session?.bookingPlan;
    const item = context.session && activeBookingItem(context.session);
    if (plan && ["active", "paused"].includes(plan.status) && (plan.status !== "active" || item?.status !== "active")) throw new AppError("Hãy tiếp tục đúng yêu cầu trong danh sách trước khi tạo đơn.", 409);
    requireBookingAttachments(context.session, args.customerAttachments);
    const [preview, policies] = await Promise.all([
      AgentBookingService.preview(context.user.id, args, context.session?.bookingDraft?.draftAddress),
      getCustomerBookingPolicies(),
    ]);
    return { ...preview, policyVersion: policies.version, bookingPolicies: policies,
      ...(plan?.status === "active" && item?.status === "active" ? { bookingPlanId: plan.id, bookingPlanItemId: item.id, bookingPlanLabel: item.label } : {}) };
  },
  execute: (context, args) => {
    requireBookingAttachments(context.session, args.customerAttachments);
    return AgentBookingService.create(context.user.id, args,
      z.object({ amount: z.number().finite().nonnegative(), addressVersion: z.string(), discountAmount: z.number().nonnegative().optional() }).parse(context.confirmedPreview), context.sessionId, context.actionId,
      context.session?.bookingDraft?.draftAddress);
  },
  reconcile: (context) => context.actionId
    ? AgentBookingService.reconcileBooking(context.user.id, context.sessionId, context.actionId) : Promise.resolve(null),
};
