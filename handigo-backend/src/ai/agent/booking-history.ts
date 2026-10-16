import { bookingSearchSchema, type AgentBookingHistoryService } from "../../services/agentBookingHistory.service";
import type { AgentSession } from "./agent-state";
import { isContinueRequest } from "./booking-actions";

export type AgentBookingSearch = Awaited<ReturnType<typeof AgentBookingHistoryService.search>> & {
  query: import("../../services/agentBookingHistory.service").BookingSearch;
  kind?: "previous_providers";
};

export const BOOKING_HISTORY_REQUEST = "Tôi muốn tìm đơn cũ. Hãy cho tôi chọn đơn theo dịch vụ, địa chỉ, thời gian hoặc mã đơn; có thể xem thêm trang nếu cần.";
export const PREVIOUS_PROVIDERS_REQUEST = "Tôi muốn chọn lại thợ từng phục vụ. Hãy tra lịch sử đơn đã hoàn thành và cho tôi chọn đúng người trước khi kiểm tra khả dụng.";

export function bookingSearchResult(session: AgentSession, args: unknown, tool = "search_my_bookings"): AgentBookingSearch | undefined {
  const result = session.collectedInformation[tool] as Omit<AgentBookingSearch, "query"> | undefined;
  if (!result || !Array.isArray(result.items) || !result.pagination) return undefined;
  return { ...result, query: bookingSearchSchema.parse(args), ...(tool === "get_previous_providers" ? { kind: "previous_providers" as const } : {}) };
}

export function parseBookingHistoryRequest(message: string, session: AgentSession):
  { tool: string; args: unknown } | { error: string } | undefined {
  const quotation = /^Xem báo giá đơn ([a-f\d]{24})\.$/i.exec(message.trim())
    ?? /^Đọc và giải thích báo giá hiện tại của đơn ([a-f\d]{24}): từng hạng mục, tiền cọc đã trả và số tiền còn thanh toán trực tiếp\.$/i.exec(message.trim());
  const refund = /^Tra hoàn tiền đơn ([a-f\d]{24})\.$/i.exec(message.trim())
    ?? /^Tra cứu chi tiết khoản hoàn của đơn ([a-f\d]{24}), số tiền, trạng thái, tiền về đâu và giao dịch ví liên quan\. Chỉ tra cứu, chưa yêu cầu hoàn mới\.$/i.exec(message.trim());
  const rebook = /^Đặt lại đơn ([a-f\d]{24}), tìm thợ phù hợp\.$/i.exec(message.trim())
    ?? /^Đặt lại đơn đang xem ([a-f\d]{24}), không giữ thợ cũ\. Chỉ chuẩn bị bản nháp và chọn lịch mới\.$/i.exec(message.trim());
  const target = quotation?.[1] ?? refund?.[1] ?? rebook?.[1];
  if (target) {
    const known = target === session.viewedOrder?.orderId || target === session.bookingDraft?.orderId
      || session.actions.some((action) => action.status === "SUCCEEDED" && (action.result as { orderId?: string } | null)?.orderId === target);
    if (!known) return { error: "Chưa xác định được đơn đang xem trong phiên. Hãy tìm và chọn đúng đơn trước." };
    return { tool: quotation ? "get_booking_quotation" : refund ? "get_booking_refunds" : "rebook_booking",
      args: { orderId: target, ...(rebook ? { useSameProvider: false } : {}) } };
  }
  if (/^Kiểm tra chuyên gia: Kiểm tra lại thợ\.?$/i.test(message.trim())) return { tool: "update_booking_draft", args: { mode: "resume" } };
  if (isContinueRequest(message)) {
    const previous = [...session.conversation].reverse().find((entry) => entry.role === "user" && !isContinueRequest(entry.content));
    const request = previous ? parseBookingHistoryRequest(previous.content, session) : undefined;
    return request && "tool" in request && request.tool === "get_previous_providers" ? request : undefined;
  }
  if (message.trim() === BOOKING_HISTORY_REQUEST || message.trim() === "Tôi muốn tìm đơn cũ.") return { tool: "search_my_bookings", args: {} };
  const draft = session.bookingDraft;
  const reuseDraft = draft && ["active", "paused"].includes(draft.status) && !draft.orderId;
  const scopedProviders = /^Tôi muốn chọn lại thợ từng phục vụ(?: cho dịch vụ ([a-f\d]{24}))?\. Tra lịch sử đơn đã hoàn thành và cho tôi chọn đúng người; giữ các thông tin khác của bản nháp\.$/i.exec(message.trim());
  if (message.trim() === PREVIOUS_PROVIDERS_REQUEST || /^(?:Thợ từng đặt|Tôi muốn chọn lại thợ từng phục vụ)[.!]?$/i.test(message.trim()) || scopedProviders) {
    const serviceId = scopedProviders?.[1] ?? (reuseDraft ? draft.values.serviceId : undefined);
    return { tool: "get_previous_providers", args: { status: "completed", ...(serviceId ? { serviceId } : {}) } };
  }
  const selectProvider = /^Chọn thợ từ đơn ([a-f\d]{24}) \(([^\r\n]+)\)(?: trong lịch sử thợ từng đặt)?\.$/i.exec(message.trim());
  if (selectProvider) {
    const item = [...session.conversation].reverse().flatMap((entry) => entry.role === "assistant" && entry.bookingSearch?.kind === "previous_providers" ? entry.bookingSearch.items : [])
      .find((entry) => entry.orderId === selectProvider[1] && entry.orderCode === selectProvider[2] && entry.status === "completed");
    if (!item?.providerId || !item.serviceId) return { error: "Chưa xác định được thợ và dịch vụ từ lịch sử của bạn. Hãy kiểm tra lại danh sách thợ từng đặt." };
    return { tool: "update_booking_draft", args: { mode: "update", preferredProviderId: item.providerId,
      ...(!reuseDraft || !draft.values.serviceId ? { serviceId: item.serviceId } : {}),
      ...(draft && !reuseDraft ? { startNew: true } : {}),
    } };
  }
  const page = /^Xem trang (\d+) của (kết quả tìm đơn cũ|danh sách thợ từng đặt)\.$/.exec(message.trim());
  if (page) {
    const providers = page[2] === "danh sách thợ từng đặt";
    const previous = [...session.conversation].reverse().find((item) => item.role === "assistant" && item.bookingSearch
      && (item.bookingSearch.kind === "previous_providers") === providers)?.bookingSearch;
    if (!previous) return { error: providers ? "Chưa có lịch sử thợ để chuyển trang. Hãy chọn Thợ từng đặt trước." : "Chưa có kết quả tìm đơn để chuyển trang. Hãy chọn Tìm đơn cũ trước." };
    const number = Number(page[1]);
    if (!Number.isSafeInteger(number) || number < 1 || number > 10000 || number > previous.pagination.totalPages) return { error: "Trang này không có trong kết quả hiện tại. Hãy tìm lại đơn hoặc chọn trang khả dụng." };
    return { tool: providers ? "get_previous_providers" : "search_my_bookings", args: bookingSearchSchema.parse({ ...previous.query, page: number }) };
  }
  const action = /^(Đặt lại|Đặt lại cùng thợ cũ|Xem báo giá|Tra hoàn tiền) đơn ([a-f\d]{24}) \(([^\r\n]+)\)(?: từ kết quả tìm đơn cũ)?\.$/i.exec(message.trim());
  if (!action) return undefined;
  const orderId = action[2];
  const item = [...session.conversation].reverse().flatMap((entry) => entry.role === "assistant" ? entry.bookingSearch?.items ?? [] : [])
    .find((entry) => entry.orderId === orderId && entry.orderCode === action[3]);
  if (!item) return { error: "Đơn này không còn trong kết quả tìm kiếm của phiên. Hãy tìm lại đơn trước khi tiếp tục." };
  const name = action[1].toLocaleLowerCase("vi-VN");
  if (name.startsWith("đặt lại")) {
    if (!["completed", "cancelled"].includes(item.status)) return { error: "Đơn này vẫn đang được xử lý. Bạn có thể mở chi tiết đơn để theo dõi; chưa tạo bản đặt lại." };
    return { tool: "rebook_booking", args: { orderId, useSameProvider: name === "đặt lại cùng thợ cũ" } };
  }
  return { tool: name === "xem báo giá" ? "get_booking_quotation" : "get_booking_refunds", args: { orderId } };
}
