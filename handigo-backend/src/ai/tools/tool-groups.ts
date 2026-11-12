import { z } from "zod";

// Tool đọc đơn được dùng chung để tìm đúng tài nguyên trước khi thao tác.
const orders = ["get_my_bookings", "get_booking", "search_my_bookings"];
export const TOOL_GROUPS = {
  booking: ["search_services", "get_service", "get_service_catalog", "get_price", "get_available_times",
    ...orders, "get_my_rewards", "get_reward_history", "get_my_reward_vouchers", "redeem_reward", "rebook_booking", "get_previous_providers",
    "get_addresses", "get_booking_vouchers", "search_booking_providers", "save_booking_address", "update_booking_draft", "create_booking"],
  support: [...orders, "create_support_ticket", "get_my_support_tickets", "get_support_ticket",
    "reply_support_ticket", "cancel_support_ticket"],
  complaint: [...orders, "create_complaint", "get_my_complaints", "get_complaint", "cancel_complaint", "add_complaint_evidence"],
  order: [...orders, "get_booking_reschedule", "request_booking_reschedule", "respond_booking_reschedule", "cancel_booking_reschedule", "get_booking_arrival_estimate", "get_booking_provider", "get_booking_feedback", "submit_booking_feedback", "rebook_booking", "get_previous_providers", "get_booking_quotation", "reject_booking_quotation", "get_booking_refunds", "get_order_provider_options", "select_order_provider", "respond_provider_reassignment", "get_cancellation_preview", "cancel_booking"],
  payment: [...orders, "get_my_wallet", "get_wallet_history", "create_wallet_deposit", "get_wallet_deposit_status", "cancel_wallet_deposit", "get_booking_quotation", "get_booking_refunds", "create_payment", "get_payment_status", "cancel_payment"],
} as const;

export const COMMON_TOOLS = ["search_customer_knowledge", "get_system_info", "get_repair_advice", "analyze_repair_images"];
export const toolGroupSchema = z.object({
  intent: z.enum(["booking", "support", "complaint", "order", "payment"]),
}).strict();
export type ToolIntent = z.infer<typeof toolGroupSchema>["intent"];

/** Chỉ nạp trước khi yêu cầu có một nhóm rõ ràng; không dùng lịch sử để ép nhóm của lượt mới. */
export function inferToolIntent(message: string): ToolIntent | undefined {
  const text = message.toLocaleLowerCase("vi-VN").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  const matches: ToolIntent[] = [];
  if (/\b(khieu nai|bang chung|complaint)\b/.test(text)) matches.push("complaint");
  if (/\b(yeu cau ho tro|phieu ho tro|ticket|lien he ho tro)\b/.test(text)) matches.push("support");
  if (/\b(thanh toan|ma qr|huy qr|quet qr|giao dich|nap vi|so du|lich su vi|vi con|vi cua toi)\b/.test(text)) matches.push("payment");
  if (/\b(doi lich|doi gio|doi ngay|tho den|tho toi|bao lau|huy don|phi huy|tien do don|trang thai don|danh gia|bao gia|hoan tien|doi tho|chon lai tho|lien he tho|vi tri tho)\b/.test(text)) matches.push("order");
  if (/\b(diem thuong|doi diem|tich diem|dat (lich|don|dich vu|lai)|dich vu|bang gia|don gia|voucher|ma (giam gia|uu dai)|dia chi|tho tung)\b/.test(text)) matches.push("booking");
  if (matches.length === 1) return matches[0];
  if (!matches.length && /\bord-[a-z0-9]+\b/.test(text)) return "order";
  return undefined;
}

export const selectToolGroup = {
  name: "select_tool_group",
  description: "Chọn nhóm theo yêu cầu mới nhất: booking = dịch vụ, giá, bản nháp, đặt lại, thợ từng phục vụ, điểm thưởng và đổi voucher; support = yêu cầu hỗ trợ; complaint = khiếu nại/bằng chứng; order = dời lịch đơn đã tạo, phản hồi/thu hồi đề nghị dời lịch, thời gian thợ đến, liên hệ/vị trí thợ, đánh giá, tìm đơn, đọc/từ chối báo giá, hoàn tiền, hủy đơn, chọn lại thợ; payment = số dư/lịch sử ví, tạo/tra/hủy nạp ví, thanh toán, hủy QR giữ đơn, báo giá/hoàn tiền/giao dịch. Có thể chuyển nhóm khi cần bước khác. Không làm thay đổi dữ liệu khách hàng.",
  requiresConfirmation: false,
  inputSchema: z.toJSONSchema(toolGroupSchema, { io: "input" }),
};

export const TOOL_ROUTING_PROMPT = `\nCông cụ được nạp theo nhóm. Nếu đã có công cụ phù hợp, gọi trực tiếp, không gọi select_tool_group lại. Nếu chưa có công cụ phù hợp, gọi select_tool_group theo yêu cầu mới nhất và ngữ cảnh, rồi tiếp tục xử lý bằng công cụ được nạp. Không yêu cầu khách chọn tên nhóm. Chỉ một nhóm được nạp mỗi lần; chuyển nhóm khi tác vụ cần bước khác. Các hướng dẫn nghiệp vụ bên trên chỉ áp dụng khi nhóm tương ứng được nạp. Không gọi công cụ chưa được cung cấp. Khi chưa rõ nhu cầu, hỏi ngắn gọn để làm rõ.
Chỉ gọi công cụ cần để trả lời yêu cầu hiện tại hoặc kiểm tra điều kiện bắt buộc của thao tác đó. Không tra cứu thêm để phòng hờ. Ví dụ: hỏi giá chỉ tìm đúng dịch vụ và giá, không đọc địa chỉ, lịch, voucher hoặc thợ; hỏi trạng thái đơn không đọc catalog; hỏi chính sách dùng nguồn kiến thức, không đọc đơn riêng nếu khách chưa hỏi một đơn cụ thể. Không gọi get_service_catalog sau khi đã xác định được dịch vụ bằng search_services/get_service. Khi update_booking_draft đã trả giá, địa chỉ, lịch hoặc voucher cần thiết, dùng kết quả đó thay vì gọi lại các tool đọc tương ứng. Kết quả đọc thành công trong lượt hiện tại được dùng lại nếu đầu vào không đổi và chưa có thao tác làm thay đổi dữ liệu; trạng thái từ lượt cũ vẫn phải kiểm tra lại khi cần kết luận hiện tại. Khi đã đủ dữ liệu, trả lời ngay hoặc hiển thị bản xác nhận, không mở rộng sang tác vụ khách chưa yêu cầu. Không bỏ kiểm tra quyền, điều kiện nghiệp vụ, xác nhận hoặc đối soát để giảm số lần gọi.`;
