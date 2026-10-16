import type { ChatbotMessage } from "./chatbot.types";
export type AgentInput = { requestId: string } & (
  { message: string } | { confirmation: { actionId: string; decision: "CONFIRM" | "REJECT" } }
  | { paymentStatus: { orderId: string } }
);
export type AgentRequest = { sessionId: string } & AgentInput;
export interface AgentConfirmation {
  booking?: { orderId: string; orderCode?: string };
  status?: "WAITING_CONFIRMATION" | "EXECUTING" | "SUCCEEDED" | "REJECTED" | "EXPIRED" | "UNKNOWN";
  actionId: string;
  tool: string;
  preview: Record<string, unknown>;
  expiresAt: string;
}
export interface AgentSessionHistory {
  items: Array<{ sessionId: string; title: string; state: AgentSession["state"]; updatedAt: string; needsAttention: boolean }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
export interface AgentSession {
  bookingDraft?: { status: "active" | "paused" | "discarded" | "booked"; revision: number; summary: string[]; missing: string[] } | null;
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
  method?: string;
  checkoutUrl?: string;
  paymentId?: string;
}

export interface AgentProgress {
  sessionId: string;
  requestId: string | null;
  state: AgentSession["state"];
  activity: { requestId: string; message: string; updatedAt: string } | null;
}
