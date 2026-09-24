import { z } from "zod";
import { AgentBookingService } from "../../services/agentBooking.service";
import { ToolRegistry } from "./tool-registry";
import type { ToolPolicy } from "./tool.interface";
import { searchServicesTool } from "./implementations/search-services.tool";
import { getServiceTool } from "./implementations/get-service.tool";
import { getPriceTool } from "./implementations/get-price.tool";
import { getAvailableTimesTool } from "./implementations/get-available-times.tool";
import { createBookingTool } from "./implementations/create-booking.tool";
import { cancelBookingTool } from "./implementations/cancel-booking.tool";
import { idSchema } from "./implementations/booking.schemas";
import { getAgentServiceCatalog } from "../../services/agentCatalog.service";
import { createPaymentTool, getPaymentStatusTool } from "./implementations/payment.tools";
import { createSupportTicketTool } from "./implementations/create-support-ticket.tool";
import { getMySupportTicketsTool } from "./implementations/get-my-support-tickets.tool";
import { getSupportTicketTool } from "./implementations/get-support-ticket.tool";
import { replySupportTicketTool } from "./implementations/reply-support-ticket.tool";
import { cancelSupportTicketTool } from "./implementations/cancel-support-ticket.tool";
import { createComplaintTool } from "./implementations/create-complaint.tool";
import { getMyComplaintsTool } from "./implementations/get-my-complaints.tool";
import { getComplaintTool } from "./implementations/get-complaint.tool";
import { cancelComplaintTool } from "./implementations/cancel-complaint.tool";
import { searchCustomerKnowledgeTool } from "./implementations/search-customer-knowledge.tool";
import { getSystemInfoTool } from "./implementations/get-system-info.tool";
import { getCancellationPreviewTool } from "./implementations/get-cancellation-preview.tool";

export function registerTools(policies: Record<string, ToolPolicy>) {
  return new ToolRegistry(policies)
    .register(createSupportTicketTool).register(getMySupportTicketsTool).register(getSupportTicketTool)
    .register(replySupportTicketTool).register(cancelSupportTicketTool)
    .register(createComplaintTool).register(getMyComplaintsTool).register(getComplaintTool).register(cancelComplaintTool)
    .register(searchCustomerKnowledgeTool).register(getSystemInfoTool).register(getCancellationPreviewTool)
    .register(searchServicesTool).register(getServiceTool)
    .register(createPaymentTool).register(getPaymentStatusTool)
    .register({ name: "get_service_catalog", description: "Xem tổng số dịch vụ đang hoạt động, danh sách dịch vụ và các dịch vụ phổ biến theo số đơn. Dùng khi khách hỏi nền tảng có bao nhiêu dịch vụ, có những dịch vụ nào hoặc dịch vụ phổ biến; không cần từ khóa.",
      inputSchema: z.object({}).strict(), mutates: false, requiresConfirmation: false, roles: ["CUSTOMER"],
      execute: () => getAgentServiceCatalog() })
    .register(getPriceTool).register(getAvailableTimesTool).register(createBookingTool).register(cancelBookingTool)
    .register({ name: "get_addresses", description: "Lấy địa chỉ đã lưu của chính khách hàng để chọn địa chỉ đặt dịch vụ.",
      inputSchema: z.object({}).strict(), mutates: false, requiresConfirmation: false, roles: ["CUSTOMER"],
      execute: (context) => AgentBookingService.addresses(context.user.id) })
    .register({ name: "get_booking", description: "Kiểm tra trạng thái đơn theo ID do hệ thống cung cấp.",
      inputSchema: z.object({ orderId: idSchema }).strict(), mutates: false, requiresConfirmation: false, roles: ["CUSTOMER"],
      execute: (context, args) => AgentBookingService.getBooking(context.user.id, args.orderId) })
    .register({ name: "get_my_bookings", description: "Tìm tối đa 10 đơn gần nhất của khách, hỗ trợ tìm theo mã đơn trước khi hủy.",
      inputSchema: z.object({ search: z.string().trim().max(100).optional() }).strict(),
      mutates: false, requiresConfirmation: false, roles: ["CUSTOMER"],
      execute: (context, args) => AgentBookingService.bookings(context.user.id, args.search) });
}
