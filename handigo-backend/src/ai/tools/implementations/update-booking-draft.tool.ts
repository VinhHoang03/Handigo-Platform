import { AppError } from "../../../utils/appError";
import { bookingDraftPatchSchema, updateBookingDraft, type BookingDraftPatch, type BookingDraftDependencies } from "../../agent/booking-draft";
import type { AgentTool } from "../tool.interface";
import { requireBookingAttachments } from "../../agent/booking-attachments";

export function createUpdateBookingDraftTool(deps?: BookingDraftDependencies): AgentTool<BookingDraftPatch> {
  return {
    name: "update_booking_draft",
    description: "Chuẩn bị/sửa bản nháp, nhận nhiều trường cùng lúc; chỉ gửi phần khách thay đổi. ID lấy từ hệ thống. Sửa điều hòa mặc định treo tường khi khách chưa nêu loại; không mở gói bổ sung. optionPreference chỉ khi khách muốn đổi loại/gói; tên khớp duy nhất được chọn ngay, đã chọn không hỏi lại. voucherCode chọn mã, null để bỏ; voucherPreference best khi khách yêu cầu mã giảm nhiều nhất, choose để mở lại lựa chọn. providerPreference là tên thợ; preferredProviderId null bỏ yêu cầu đích danh; providerCriteria nearest/highest_rating/most_completed khi khách yêu cầu chọn theo tiêu chí, choose để xem danh sách. Không gửi đồng thời ID thợ và tiêu chí, hoặc mã voucher và yêu cầu best. addressPreference giữ địa chỉ chưa xác định, khớp duy nhất sẽ tái sử dụng địa chỉ lưu. Địa chỉ mới giữ tạm bằng save_booking_address rồi resume, mặc định chỉ lưu khi đặt đơn thành công. saveAddressToBook false khi khách chỉ dùng địa chỉ một lần/không lưu; true khi khách yêu cầu lưu lại, không xóa địa chỉ đã có. Thiếu lựa chọn đưa choiceGroups, đủ dữ liệu gửi form. mode pause/resume/discard; startNew chỉ khi đặt thêm. Không tạo đơn hoặc trừ tiền.",
    inputSchema: bookingDraftPatchSchema, mutates: false, requiresConfirmation: false, roles: ["CUSTOMER"],
    execute: async (context, input) => {
      if (!context.session) throw new AppError("Không tìm thấy phiên đặt lịch.", 409);
      if (context.session.pendingAction || context.session.requiresReconciliation) throw new AppError("Cần xử lý hành động đang chờ trước khi sửa bản nháp.", 409);
      requireBookingAttachments(context.session, input.customerAttachments);
      const request = context.session.activeRequest?.input;
      if (request && "message" in request && request.customerAttachments !== undefined) {
        input = { ...input, customerAttachments: request.customerAttachments };
      }
      const services = deps ?? (await import("../../../services/agentBooking.service")).AgentBookingService;
      const next = await updateBookingDraft(context.session.bookingDraft, input, context.user.id, {
        ...services,
        addresses: (userId) => {
          if (!context.bookingAddressLookup) return services.addresses(userId);
          return context.bookingAddressLookup.value ??= services.addresses(userId).catch((error) => {
            context.bookingAddressLookup!.value = undefined;
            throw error;
          });
        },
      }, request && "message" in request ? request.message : undefined);
      context.signal.throwIfAborted();
      if (input.startNew) context.session.taskVersion += 1;
      context.session.bookingDraft = next;
      context.session.rebookProposal = undefined;
      if (input.startNew || input.mode === "discard") context.session.draftBackup = undefined;
      if (next.lookupFailures?.length) context.session.recovery = { tool: "update_booking_draft", arguments: { mode: "resume" },
        taskVersion: context.session.taskVersion, revision: next.revision };
      return next;
    },
  };
}
export const updateBookingDraftTool = createUpdateBookingDraftTool();
