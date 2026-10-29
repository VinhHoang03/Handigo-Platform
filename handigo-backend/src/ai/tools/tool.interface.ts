import type { z } from "zod";
import type { RequestUser } from "../../middlewares/authContext";

export interface ToolContext {
  session?: import("../agent/agent-state").AgentSession;
  user: RequestUser;
  sessionId: string;
  signal: AbortSignal;
  confirmedPreview?: unknown;
  actionId?: string;
  actionCreatedAt?: string;
  bookingPaymentActionId?: string;
  readOnly?: boolean;
  replaceBookingDraft?: boolean;
  bookingAddressLookup?: { value?: Promise<import("../agent/booking-draft").DraftAddress[]> };
}

export interface AgentTool<T = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<T>;
  requiresConfirmation: boolean;
  mutates: boolean;
  roles: RequestUser["role"][];
  preview?: (context: ToolContext, args: T) => Promise<unknown>;
  execute(context: ToolContext, args: T): Promise<unknown>;
  reconcile?: (context: ToolContext, args: T) => Promise<unknown | null>;
  reply?: (result: unknown) => { message: string; state: "COMPLETED" | "WAITING_USER_INPUT"; retryable?: boolean } | undefined;
}

export interface ToolPolicy {
  enabled?: boolean;
  roles?: RequestUser["role"][];
  requiresConfirmation?: boolean;
}
