import type { ReadOnlyGraphData } from "./graph-state";

// Danh sách đóng cho G3; thêm tool cần kiểm tra cả service, không chỉ cờ mutates.
export const READ_ONLY_GRAPH_TOOLS = Object.freeze([
  "search_customer_knowledge", "get_system_info", "search_services", "get_service_catalog", "get_service",
  "get_addresses", "get_booking", "get_my_bookings",
] as const);

export function routeReadOnlyDecision(data: ReadOnlyGraphData) {
  if (data.turn.waitingForModelRetry) return "wait_model_retry";
  return !data.turn.reply && data.turn.decision?.type === "TOOL_CALL" ? "read_tool" : "finish";
}
