import type { ChatbotMessage } from "./chatbot.types";
export type AgentInput = { requestId: string } & (
  { message: string } | { confirmation: { actionId: string; decision: "CONFIRM" | "REJECT" } }
  | { paymentStatus: { orderId: string } }
);
export type AgentRequest = { sessionId: string } & AgentInput;
export interface AgentConfirmation {
  actionId: string;
  tool: string;
  preview: Record<string, unknown>;
  expiresAt: string;
}
export interface AgentSession {
  expiresAt?: string | null;
  payment?: AgentPayment | null;
  sessionId: string;
  state: "RUNNING" | "WAITING_USER_INPUT" | "WAITING_CONFIRMATION" | "EXECUTING_TOOL" | "COMPLETED" | "FAILED";
  currentGoal: string;
  messages: ChatbotMessage[];
  pendingConfirmation: AgentConfirmation | null;
  requiresReconciliation: boolean;
  interruptedRequest: AgentInput | null;
  requiresNewSession: boolean;
}

export interface AgentPayment {
  orderId: string;
  orderCode: string;
  status: "unpaid" | "pending" | "paid" | "deposit_paid" | "cash_pending" | "blocked" | "failed" | "refunded";
  message: string;
  amount?: number;
  checkoutUrl?: string;
}
