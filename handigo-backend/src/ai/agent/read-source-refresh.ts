import type { AgentSession } from "./agent-state";
import type { AgentTool } from "../tools/tool.interface";

// Danh sách tường minh: không suy quyền phát lại từ riêng cờ mutates=false của một tool mới.
export const REFRESHABLE_READ_TOOLS = new Set([
  "search_customer_knowledge", "get_system_info", "search_services", "get_service", "get_service_catalog", "get_addresses",
  "get_price", "get_available_times", "get_booking_vouchers", "search_booking_providers", "get_cancellation_preview",
  "get_booking", "get_my_bookings", "search_my_bookings", "get_previous_providers", "get_booking_provider",
  "get_booking_feedback", "get_booking_quotation", "get_booking_refunds", "get_order_provider_options", "get_payment_status",
  "get_my_support_tickets", "get_support_ticket", "get_my_complaints", "get_complaint",
]);
export interface ReadSource {
  tool: string;
  args: unknown;
  messageId: string;
}

export function rememberReadSource(session: AgentSession, tool: AgentTool, args: unknown) {
  const frame = session.modelWorkflow;
  if (!frame || tool.mutates || tool.requiresConfirmation || !REFRESHABLE_READ_TOOLS.has(tool.name)) return;
  const message = session.conversation[session.conversation.length - 1];
  if (message?.role !== "tool" || message.tool !== tool.name) return;
  const sources = frame.readSources ??= [];
  sources.push({ tool: tool.name, args: structuredClone(args), messageId: message.id });
  // Vượt giới hạn chỉ bỏ kế hoạch đọc lại; kết quả lịch sử vẫn được vô hiệu trong bước refresh.
  if (sources.length > 32) sources.shift();
}

export function invalidateReadSnapshots(session: AgentSession) {
  for (const message of session.conversation) {
    if (message.role === "tool" && message.tool && REFRESHABLE_READ_TOOLS.has(message.tool)) message.supersededRead = true;
  }
  for (const name of REFRESHABLE_READ_TOOLS) delete session.collectedInformation[name];
  // Tóm tắt có thể chứa kết quả cũ; lịch sử gốc vẫn được giữ để tái tạo ngữ cảnh.
  session.contextSummary = undefined;
}
