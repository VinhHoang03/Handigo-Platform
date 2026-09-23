import { AgentBookingService } from "../../../services/agentBooking.service";
import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { bookingSchema, type BookingArguments } from "./booking.schemas";
export const createBookingTool: AgentTool<BookingArguments> = {
  name: "create_booking", description: "Tạo đơn đặt ngay hoặc lịch hẹn sau xác nhận. Chưa hỗ trợ đặt định kỳ, voucher hay chọn đích danh thợ qua agent.",
  inputSchema: bookingSchema, mutates: true, requiresConfirmation: true, roles: ["CUSTOMER"],
  preview: (context, args) => AgentBookingService.preview(context.user.id, args),
  execute: (context, args) => AgentBookingService.create(context.user.id, args,
    z.object({ amount: z.number().finite().nonnegative(), addressVersion: z.string() }).parse(context.confirmedPreview)),
};
