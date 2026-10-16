import { z } from "zod";

// Tool đọc đơn được dùng chung để tìm đúng tài nguyên trước khi thao tác.
const orders = ["get_my_bookings", "get_booking", "search_my_bookings"];
export const TOOL_GROUPS = {
  booking: ["search_services", "get_service", "get_service_catalog", "get_price", "get_available_times",
    ...orders, "rebook_booking", "get_previous_providers",
    "get_addresses", "get_booking_vouchers", "search_booking_providers", "save_booking_address", "update_booking_draft", "create_booking"],
  support: [...orders, "create_support_ticket", "get_my_support_tickets", "get_support_ticket",
    "reply_support_ticket", "cancel_support_ticket"],
  complaint: [...orders, "create_complaint", "get_my_complaints", "get_complaint", "cancel_complaint"],
  order: [...orders, "rebook_booking", "get_previous_providers", "get_booking_quotation", "reject_booking_quotation", "get_booking_refunds", "get_order_provider_options", "select_order_provider", "respond_provider_reassignment", "get_cancellation_preview", "cancel_booking"],
  payment: [...orders, "get_booking_quotation", "get_booking_refunds", "create_payment", "get_payment_status"],
} as const;

export const COMMON_TOOLS = ["search_customer_knowledge", "get_system_info"];
export const toolGroupSchema = z.object({
  intent: z.enum(["booking", "support", "complaint", "order", "payment"]),
}).strict();
export type ToolIntent = z.infer<typeof toolGroupSchema>["intent"];

export const selectToolGroup = {
  name: "select_tool_group",
  description: "Chọn nhóm công cụ theo yêu cầu mới nhất và ngữ cảnh: booking = tìm dịch vụ, giá, đặt/sửa/tiếp tục bản nháp, đặt lại đơn cũ hoặc tìm thợ từng phục vụ; support = yêu cầu hỗ trợ; complaint = khiếu nại; order = tìm đơn nhiều tiêu chí, đọc/từ chối báo giá, tra hoàn tiền, hủy đơn, phí hủy, chọn lại thợ cho đơn đã tạo; payment = thanh toán, đọc báo giá hoặc tra hoàn tiền/giao dịch. Chọn một nhóm mỗi lần; có thể chuyển nhóm khi cần bước khác. Không làm thay đổi dữ liệu khách hàng.",
  requiresConfirmation: false,
  inputSchema: z.toJSONSchema(toolGroupSchema, { io: "input" }),
};

export const TOOL_ROUTING_PROMPT = `\nCông cụ được nạp theo nhóm. Nếu chưa có công cụ phù hợp, gọi select_tool_group theo yêu cầu mới nhất và ngữ cảnh, rồi tiếp tục xử lý bằng công cụ được nạp. Không yêu cầu khách chọn tên nhóm. Chỉ một nhóm được nạp mỗi lần; chuyển nhóm khi tác vụ cần bước khác. Các hướng dẫn nghiệp vụ bên trên chỉ áp dụng khi nhóm tương ứng được nạp. Không gọi công cụ chưa được cung cấp. Khi chưa rõ nhu cầu, hỏi ngắn gọn để làm rõ.`;
