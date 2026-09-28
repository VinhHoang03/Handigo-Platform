import { AppError } from "../../../utils/appError";
import { bookingDraftPatchSchema, updateBookingDraft, type BookingDraftPatch, type BookingDraftDependencies } from "../../agent/booking-draft";
import type { AgentTool } from "../tool.interface";

export function createUpdateBookingDraftTool(deps?: BookingDraftDependencies): AgentTool<BookingDraftPatch> {
  return {
    name: "update_booking_draft",
    description: "Chuẩn bị/sửa bản nháp đặt lịch, nhận nhiều trường cùng lúc. Dùng ngay khi khách muốn đặt dịch vụ: serviceQuery là từ khóa ngắn, serviceId/optionId chỉ lấy từ hệ thống. Chỉ gửi trường khách đã nói; backend tự dùng địa chỉ mặc định hoặc duy nhất, Đặt ngay, Chuyển khoản và số lượng 1 khi phù hợp. Đủ dữ liệu sẽ gửi ngay form xác nhận, không hỏi lại các mặc định; chỉ hỏi gộp phần thực sự thiếu. schedulePreference/addressPreference giữ yêu cầu chưa xác định, không được bỏ qua. mode pause khi đổi chủ đề, resume để tiếp tục, discard để bỏ nháp; startNew chỉ khi khách yêu cầu đơn mới. Không tạo đơn hoặc trừ tiền.",
    inputSchema: bookingDraftPatchSchema, mutates: false, requiresConfirmation: false, roles: ["CUSTOMER"],
    execute: async (context, input) => {
      if (!context.session) throw new AppError("Không tìm thấy phiên đặt lịch.", 409);
      if (context.session.pendingAction || context.session.requiresReconciliation) throw new AppError("Cần xử lý hành động đang chờ trước khi sửa bản nháp.", 409);
      const services = deps ?? (await import("../../../services/agentBooking.service")).AgentBookingService;
      const next = await updateBookingDraft(context.session.bookingDraft, input, context.user.id, services);
      context.signal.throwIfAborted();
      if (input.startNew) context.session.taskVersion += 1;
      context.session.bookingDraft = next;
      return next;
    },
  };
}
export const updateBookingDraftTool = createUpdateBookingDraftTool();
