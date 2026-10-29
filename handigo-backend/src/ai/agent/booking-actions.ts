import { z } from "zod";
import { bookingDraftPatchSchema } from "./booking-draft";
import { idSchema } from "../tools/implementations/booking.schemas";
import { agentFeedbackSchema } from "../../services/agentFeedback.service";

// Nút giao diện gửi đúng giá trị đã chọn; nội dung chat chỉ dùng để hiển thị.
export const bookingActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("update"), revision: z.number().int("Phiên bản bản nháp phải là số nguyên.").nonnegative("Phiên bản bản nháp không hợp lệ."), patch: bookingDraftPatchSchema.pick({
    mode: true, quantity: true, selectedOptions: true, addressId: true, paymentMethod: true,
    orderType: true, scheduledAt: true, preferredProviderId: true, saveAddressToBook: true, voucherCode: true,
  }) }).strict(),
  z.object({ type: z.literal("rebook_decision"), proposalId: z.string().uuid("Yêu cầu chuyển bản nháp không hợp lệ."), accept: z.boolean() }).strict(),
  z.object({ type: z.literal("restore_draft"), backupId: z.string().uuid("Bản nháp dự phòng không hợp lệ.") }).strict(),
  z.object({ type: z.literal("provider"), orderId: idSchema }).strict(),
  z.object({ type: z.literal("feedback"), feedback: agentFeedbackSchema }).strict(),
]);
export type BookingAction = z.input<typeof bookingActionSchema>;

export const CONTINUE_REQUEST = "Tiếp tục yêu cầu đang thực hiện từ kết quả đã lưu; không thực hiện lại thao tác đã thành công.";
export const isContinueRequest = (message: string) => ["Tiếp tục yêu cầu.", CONTINUE_REQUEST].includes(message.trim());
