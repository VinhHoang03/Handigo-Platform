import { AgentBookingService } from "../../../services/agentBooking.service";
import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { bookingSchema, type BookingArguments } from "./booking.schemas";
import { requireBookingAttachments } from "../../agent/booking-attachments";
import { getCustomerBookingPolicies } from "../../../services/bookingPolicy.service";
export const createBookingTool: AgentTool<BookingArguments> = {
  name: "create_booking", description: "Tạo đơn đặt ngay hoặc lịch hẹn một lần sau xác nhận, hỗ trợ voucher và chuyên gia ưu tiên đã kiểm tra.",
  inputSchema: bookingSchema, mutates: true, requiresConfirmation: true, roles: ["CUSTOMER"],
  preview: async (context, args) => {
    requireBookingAttachments(context.session, args.customerAttachments);
    const [preview, policies] = await Promise.all([
      AgentBookingService.preview(context.user.id, args, context.session?.bookingDraft?.draftAddress),
      getCustomerBookingPolicies(),
    ]);
    return { ...preview, policyVersion: policies.version, bookingPolicies: policies };
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
