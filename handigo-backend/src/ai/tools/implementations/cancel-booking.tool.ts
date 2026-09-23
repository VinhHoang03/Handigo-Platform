import { z } from "zod";
import { AgentBookingService } from "../../../services/agentBooking.service";
import type { AgentTool } from "../tool.interface";
import { cancelSchema } from "./booking.schemas";
export const cancelBookingTool: AgentTool<z.infer<typeof cancelSchema>> = {
  name: "cancel_booking", description: "Hủy một đơn của khách sau khi xác nhận phí hủy và số tiền hoàn.",
  inputSchema: cancelSchema, mutates: true, requiresConfirmation: true, roles: ["CUSTOMER"],
  preview: (context, args) => AgentBookingService.previewCancel(context.user.id, args.orderId, args.reason),
  execute: (context, args) => AgentBookingService.cancel(context.user.id, args.orderId, args.reason,
    z.object({ paidAmount: z.number(), refundAmount: z.number(), cancellationFee: z.number() }).parse(context.confirmedPreview)),
};
