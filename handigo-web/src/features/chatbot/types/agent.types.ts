import type { ChatbotMessage } from "./chatbot.types";
import type { Order } from "@/types/booking";

export interface AgentBookingSearch {
  kind?: "previous_providers";
  items: Array<{
    orderId: string; orderCode: string; status: Order["status"]; paymentStatus: Order["paymentStatus"];
    serviceId: string | null; service: string; serviceType: "fixed_price" | "variable_price" | null; hasQuotation: boolean;
    address: { fullAddress: string; ward: string; province: string } | null;
    providerId: string | null; provider: string | null; createdAt: string; scheduledAt?: string | null;
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
export type AgentInput = { requestId: string } & (
  { message: string; customerAttachments?: string[]; bookingAction?: AgentBookingAction } | { confirmation: { actionId: string; decision: "CONFIRM" | "REJECT"; policyConsent?: AgentPolicyConsent } }
  | { paymentStatus: { orderId: string } }
);
export type AgentPolicyConsent = { accepted: true; version: string };
export type AgentBookingAction =
  | { type: "update"; revision: number; patch: { mode?: "update" | "pause" | "discard" | "resume"; quantity?: number;
      selectedOptions?: Array<{ optionId: string; quantity: number }>; addressId?: string; paymentMethod?: "bank" | "wallet" | "cash";
      orderType?: "normal" | "scheduled"; scheduledAt?: string | null; preferredProviderId?: string | null } }
  | { type: "rebook_decision"; proposalId: string; accept: boolean }
  | { type: "restore_draft"; backupId: string };
export type AgentSend = (message: string, customerAttachments?: string[], bookingAction?: AgentBookingAction) => Promise<void>;
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
export interface AgentBookingValues {
  serviceId?: string;
  uniformQuantity?: number;
  selectedOptions?: Array<{ optionId: string; quantity: number }>;
  addressId?: string;
  orderType?: "normal" | "scheduled";
  scheduledAt?: string;
  paymentMethod?: "bank" | "wallet" | "cash";
  problemDescription?: string;
  customerAttachments?: string[];
  voucherCode?: string;
  preferredProviderId?: string;
}
export interface AgentSession {
  retryableStep?: { tool: string } | null;
  rebookProposal?: { id: string } | null;
  draftBackup?: { id: string } | null;
  viewedOrder?: { orderId: string; orderCode: string } | null;
  orderActions?: { orderId: string; orderCode: string; quotation: boolean; refunds: boolean; payment: boolean; rebook: boolean; reason?: string } | null;
  bookingDraft?: { status: "active" | "paused" | "discarded" | "booked"; revision: number; summary: string[]; missing: string[];
    hasDraftAddress?: boolean;
    values?: AgentBookingValues;
    providerCandidates?: Array<{ id: string; name: string; averageRating?: number; totalCompletedOrders?: number; distanceMeters?: number }>;
    orderId?: string;
  } | null;
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
