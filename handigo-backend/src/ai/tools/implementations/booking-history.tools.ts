import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { idSchema } from "./booking.schemas";
import { AgentBookingHistoryService, bookingSearchSchema, ownedBooking } from "../../../services/agentBookingHistory.service";
import { AgentBookingService } from "../../../services/agentBooking.service";
import { bookingAddressLabel, updateBookingDraft } from "../../agent/booking-draft";
import { AppError } from "../../../utils/appError";
import { requireBookingAttachments } from "../../agent/booking-attachments";
import { randomUUID } from "node:crypto";
import { refundReply } from "../../agent/booking-read-results";

export const searchMyBookingsTool: AgentTool<z.infer<typeof bookingSearchSchema>> = {
  name: "search_my_bookings", roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
  description: "Tìm đơn của chính khách theo mã/mô tả (search), dịch vụ, địa chỉ/người nhận/ghi chú, thợ, trạng thái và khoảng ngày có offset +07:00. dateField mặc định createdAt, chọn scheduledAt nếu tìm ngày hẹn. Trả items và pagination; dùng page tiếp theo nếu cần. Dùng để xác định đúng đơn trước khi đặt lại, báo giá hoặc tra hoàn tiền; nhiều kết quả phải để khách chọn.",
  inputSchema: bookingSearchSchema,
  execute: (context, args) => AgentBookingHistoryService.search(context.user.id, args),
};
export const getPreviousProvidersTool: AgentTool<z.infer<typeof bookingSearchSchema>> = {
  name: "get_previous_providers", roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
  description: "Tìm thợ thực tế đã phục vụ qua các đơn completed của chính khách, theo dịch vụ, địa chỉ, thời gian, tên thợ và phân trang. Không dùng preferredProviderId của đơn cũ làm bằng chứng thợ đã phục vụ. Nhiều người/đơn phù hợp phải hỏi khách chọn; dùng ID providerId thật trong update_booking_draft để kiểm tra khả dụng hiện tại.",
  inputSchema: bookingSearchSchema,
  execute: (context, args) => AgentBookingHistoryService.previousProviders(context.user.id, args),
};
export const getBookingRefundsTool: AgentTool<{ orderId: string }> = {
  name: "get_booking_refunds", roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
  description: "Tra chi tiết khoản hoàn trên đơn của khách: chính sách, số tiền, trạng thái, đích nhận và giao dịch hoàn về ví liên quan. Không tạo khoản hoàn, không sửa thanh toán. Không cộng khoản hoàn với giao dịch ví của cùng lần hoàn, không khẳng định đã nhận tiền nếu chưa có bằng chứng thành công.",
  inputSchema: z.object({ orderId: idSchema }).strict(),
  execute: (context, args) => AgentBookingHistoryService.refunds(context.user.id, args.orderId),
  reply: (result) => ({ state: "WAITING_USER_INPUT", message: refundReply(result as Awaited<ReturnType<typeof AgentBookingHistoryService.refunds>>) }),
};

const rebookSchema = z.object({ orderId: idSchema, useSameProvider: z.boolean().default(false) }).strict();
export const rebookBookingTool: AgentTool<z.infer<typeof rebookSchema>> = {
  name: "rebook_booking", roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
  description: "Khi khách yêu cầu đặt lại đơn completed/cancelled đã xác định, chuẩn bị bản nháp từ dịch vụ, tùy chọn/số lượng, địa chỉ và phương thức cũ. Nếu đang soạn bản nháp khác, trả bước chọn giữ hoặc chuyển; không tự vượt qua lựa chọn. useSameProvider true chỉ khi khách muốn giữ thợ thực tế của đơn completed. Luôn yêu cầu lịch mới, kiểm tra lại giá/voucher/thợ; không sao chép giao dịch, lịch cũ hoặc ảnh. Chưa tạo đơn hoặc thu tiền.",
  inputSchema: rebookSchema,
  execute: async (context, args) => {
    const session = context.session;
    if (!session || session.pendingAction || session.requiresReconciliation) throw new AppError("Cần xử lý hành động đang chờ trước khi đặt lại.", 409);
    const order = await ownedBooking(context.user.id, args.orderId);
    if (!["completed", "cancelled"].includes(order.status)) throw new AppError("Đơn này vẫn đang được xử lý. Hãy mở chi tiết đơn để theo dõi; chưa tạo bản đặt lại.", 409);
    if (session.bookingDraft && ["active", "paused"].includes(session.bookingDraft.status) && !session.bookingDraft.orderId
      && !context.replaceBookingDraft) {
      session.rebookProposal = { id: randomUUID(), arguments: args, revision: session.bookingDraft.revision, taskVersion: session.taskVersion };
      return { requiresDraftReplacement: true };
    }
    const request = session.activeRequest?.input;
    const newAttachments = request && "message" in request ? request.customerAttachments : undefined;
    requireBookingAttachments(session, newAttachments);
    const service = await AgentBookingService.service(String(order.serviceId));
    const addresses = await AgentBookingService.addresses(context.user.id);
    const address = addresses.find((item) => item.id === String(order.addressId));
    const oldAddress = order.addressSnapshot;
    const sameAddress = address && (!oldAddress || ["fullAddress", "ward", "province", "recipientName", "recipientPhone"]
      .every((field) => (address[field as keyof typeof address] ?? "") === (oldAddress[field as keyof typeof oldAddress] ?? "")));
    const previousOptions = order.selectedOptionsSnapshot;
    const uniform = previousOptions.length === 1 && previousOptions[0].optionId === null ? previousOptions[0].quantity ?? 1 : undefined;
    const options = previousOptions.filter((item) => item.optionId).map((item) => ({ optionId: String(item.optionId), quantity: item.quantity ?? 1 }));
    const canReuseOptions = options.every((item) => service.options.some((option) => String(option._id) === item.optionId
      && (option.allowsQuantity || item.quantity === 1)));
    const providerId = args.useSameProvider && order.status === "completed" && order.providerId ? String(order.providerId) : undefined;
    const draft = await updateBookingDraft(undefined, {
      mode: "update", serviceId: String(order.serviceId),
      ...(uniform !== undefined ? { quantity: uniform } : canReuseOptions ? { selectedOptions: options } : { optionPreference: "Chọn lại gói vì tùy chọn cũ đã thay đổi hoặc ngừng hoạt động" }),
      ...(sameAddress ? { addressId: address.id } : { addressPreference: oldAddress
        ? bookingAddressLabel({ id: String(order.addressId), isDefault: false, ...oldAddress }) : "Cần chọn lại địa chỉ của đơn cũ" }),
      orderType: "scheduled", schedulePreference: "Chọn ngày giờ mới cho lần đặt lại",
      paymentMethod: order.paymentMethod, problemDescription: order.problemDescription ?? "",
      ...(newAttachments !== undefined ? { customerAttachments: newAttachments } : {}),
      ...(order.voucherSnapshot?.code ? { voucherCode: order.voucherSnapshot.code } : {}),
      ...(providerId ? { preferredProviderId: providerId } : {}),
    }, context.user.id, AgentBookingService);
    // Địa chỉ cùng tên nhưng đổi người nhận không được tự coi là địa chỉ cũ.
    if (!sameAddress) {
      delete draft.values.addressId;
      draft.addressPreference = "Cần chọn lại địa chỉ và người nhận của đơn cũ";
      if (!draft.missing.includes("Kiểm tra lại địa chỉ và người nhận")) draft.missing.push("Kiểm tra lại địa chỉ và người nhận");
    }
    if (!canReuseOptions) {
      draft.rebookNeedsOptionReview = true;
      delete draft.values.uniformQuantity;
      draft.missing.push("Gói cũ đã thay đổi. Vui lòng chọn lại gói và số lượng trước khi đặt lại");
      draft.summary.push(`Lựa chọn cũ cần kiểm tra lại: ${previousOptions.map((item) => `${item.name} × ${item.quantity ?? 1}`).join("; ")}.`);
    }
    draft.summary.unshift(`Đặt lại từ đơn ${order.orderCode}; giá, voucher và lịch được kiểm tra theo thời điểm mới.`);
    if (args.useSameProvider && !providerId) {
      draft.providerPreference = "Chưa xác định được thợ thực tế đã phục vụ đơn cũ";
      draft.missing.push("Chưa xác định được thợ thực tế của đơn cũ; hãy chọn thợ hoặc cho phép hệ thống tự tìm");
      draft.summary.push("Đơn nguồn chưa có thợ đã hoàn thành phục vụ. Chưa chọn lại thợ cũ hoặc tự thay người.");
    }
    context.signal.throwIfAborted();
    if (session.bookingDraft && ["active", "paused"].includes(session.bookingDraft.status) && !session.bookingDraft.orderId) {
      session.draftBackup = { id: randomUUID(), draft: JSON.parse(JSON.stringify(session.bookingDraft)) };
    }
    session.taskVersion += 1;
    session.bookingDraft = draft;
    session.rebookProposal = undefined;
    return draft;
  },
  reply: (result) => (result as { requiresDraftReplacement?: boolean }).requiresDraftReplacement
    ? { state: "WAITING_USER_INPUT", message: "Bạn muốn giữ bản đang soạn hay đặt lại đơn cũ? Bạn vẫn có thể quay lại bản nháp trước." } : undefined,
};
