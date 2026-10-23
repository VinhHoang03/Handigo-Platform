export type AgentState = "RUNNING" | "WAITING_USER_INPUT" | "WAITING_CONFIRMATION" | "EXECUTING_TOOL" | "COMPLETED" | "FAILED";

export interface AgentMessage {
  bookingSearch?: import("./booking-history").AgentBookingSearch;
  customerAttachments?: string[];
  confirmationActionId?: string;
  choiceGroups?: import("../llm/llm.interface").AgentChoiceGroup[];
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  createdAt: string;
  tool?: string;
}

export interface PendingAction {
  taskVersion: number;
  id: string;
  tool: string;
  arguments: unknown;
  preview: unknown;
  createdAt: string;
  expiresAt: string;
  executionStartedAt?: string;
  status: "WAITING_CONFIRMATION" | "EXECUTING" | "SUCCEEDED" | "REJECTED" | "EXPIRED" | "UNKNOWN";
  result?: unknown;
  policyConsent?: { version: string; acceptedAt: string; actionId: string };
}

export interface AgentSession {
  rebookProposal?: { id: string; arguments: { orderId: string; useSameProvider: boolean }; revision: number; taskVersion: number };
  draftBackup?: { id: string; draft: import("./booking-draft").BookingDraft };
  viewedOrder?: { orderId: string; orderCode: string };
  recovery?: { tool: string; arguments: unknown; taskVersion: number; revision?: number; stage?: "address" | "preview"; replaceDraft?: boolean };
  lastDraftRequest?: { requestId: string; revision: number; taskVersion: number };
  uploadedAttachments?: string[];
  contextSummary?: { content: string; throughMessageId: string };
  bookingDraft?: import("./booking-draft").BookingDraft;
  activity?: { requestId: string; message: string; updatedAt: string };
  taskVersion: number;
  id: string;
  userId: string;
  currentGoal: string;
  state: AgentState;
  conversation: AgentMessage[];
  collectedInformation: Record<string, unknown>;
  progress: Array<{ tool: string; status: "SUCCEEDED" | "FAILED"; at: string }>;
  pendingAction: PendingAction | null;
  actions: PendingAction[];
  receipts: Array<{ requestId: string; digest: string; message: string }>;
  activeRequest: { requestId: string; digest: string; input: AgentInput } | null;
  requiresReconciliation: boolean;
}

export type AgentInput =
  | { requestId: string; message: string; customerAttachments?: string[]; bookingAction?: import("./booking-actions").BookingAction }
  | { requestId: string; paymentStatus: { orderId: string } }
  | { requestId: string; confirmation: { actionId: string; decision: "CONFIRM" | "REJECT"; policyConsent?: { accepted: true; version: string } } };

export const newSession = (id: string, userId: string): AgentSession => ({
  id, userId, taskVersion: 0, currentGoal: "", state: "WAITING_USER_INPUT", conversation: [],
  collectedInformation: {}, progress: [], pendingAction: null, actions: [], receipts: [],
  activeRequest: null, requiresReconciliation: false,
});
