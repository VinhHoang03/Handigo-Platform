export type AgentState = "RUNNING" | "WAITING_USER_INPUT" | "WAITING_CONFIRMATION" | "EXECUTING_TOOL" | "COMPLETED" | "FAILED";

export interface AgentMessage {
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
  status: "WAITING_CONFIRMATION" | "EXECUTING" | "SUCCEEDED" | "REJECTED" | "EXPIRED" | "UNKNOWN";
  result?: unknown;
}

export interface AgentSession {
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
  | { requestId: string; message: string }
  | { requestId: string; paymentStatus: { orderId: string } }
  | { requestId: string; confirmation: { actionId: string; decision: "CONFIRM" | "REJECT" } };

export const newSession = (id: string, userId: string): AgentSession => ({
  id, userId, taskVersion: 0, currentGoal: "", state: "WAITING_USER_INPUT", conversation: [],
  collectedInformation: {}, progress: [], pendingAction: null, actions: [], receipts: [],
  activeRequest: null, requiresReconciliation: false,
});
