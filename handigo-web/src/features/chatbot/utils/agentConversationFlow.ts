import type { AgentSession } from "../types/agent.types";

export type AgentConversationFlow = "booking" | "payment" | "cancellation" | "refund" | "quotation"
  | "provider" | "reassignment" | "feedback" | "support" | "complaint" | "history" | "general";

const toolFlows: Record<string, AgentConversationFlow> = {
  create_booking: "booking", save_booking_address: "booking", update_booking_draft: "booking",
  create_payment: "payment", cancel_payment: "payment", get_payment_status: "payment",
  cancel_booking: "cancellation", get_cancellation_preview: "cancellation", get_booking_refunds: "refund",
  get_booking_quotation: "quotation", reject_booking_quotation: "quotation",
  get_booking_provider: "provider", get_order_provider_options: "reassignment", select_order_provider: "reassignment", respond_provider_reassignment: "reassignment",
  get_booking_feedback: "feedback", submit_booking_feedback: "feedback",
  create_support_ticket: "support", get_my_support_tickets: "support", get_support_ticket: "support", reply_support_ticket: "support", cancel_support_ticket: "support",
  create_complaint: "complaint", get_my_complaints: "complaint", get_complaint: "complaint", cancel_complaint: "complaint", add_complaint_evidence: "complaint",
};

// Chỉ phân loại giao diện; quyền và điều kiện thao tác vẫn do backend quyết định.
export function getAgentConversationFlow(session?: AgentSession | null): AgentConversationFlow {
  const pending = session?.pendingConfirmation;
  if (pending && toolFlows[pending.tool]) return toolFlows[pending.tool];
  const messages = session?.messages ?? [];
  const userIndex = messages.findLastIndex((message) => message.sender === "user");
  const confirmation = messages.slice(userIndex + 1).findLast((message) => message.confirmation)?.confirmation;
  if (confirmation && toolFlows[confirmation.tool]) return toolFlows[confirmation.tool];
  const request = (messages[userIndex]?.content ?? session?.currentGoal ?? "").toLocaleLowerCase("vi-VN")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  if (/khieu nai|bang chung/.test(request)) return "complaint";
  if (/ho tro|phieu ho tro|ticket/.test(request)) return "support";
  if (/danh gia|\bsao\b/.test(request)) return "feedback";
  if (/bao gia/.test(request)) return "quotation";
  if (/huy.*(?:qr|giao dich|thanh toan)|(?:qr|giao dich).*huy/.test(request)) return "payment";
  if (/huy don|phi huy/.test(request)) return "cancellation";
  if (/hoan tien|khoan hoan/.test(request)) return "refund";
  if (/doi tho|thay tho|nguoi thay the|chon lai tho/.test(request)) return "reassignment";
  if (/tho thuc hien|vi tri tho|lien he tho|goi tho|nhan tin.*tho/.test(request)) return "provider";
  if (/tim don cu|lich su don|tho tung|chon tho tu don|xem trang/.test(request)) return "history";
  if (/thanh toan|nap vi|ma qr|quet qr/.test(request)) return "payment";
  if (/dat|dich vu|dia chi|so luong|lich hen|voucher|chuyen gia/.test(request)) return "booking";
  return "general";
}
