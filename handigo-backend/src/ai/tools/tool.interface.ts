import type { z } from "zod";
import type { RequestUser } from "../../middlewares/authContext";

export interface ToolContext {
  user: RequestUser;
  sessionId: string;
  signal: AbortSignal;
  confirmedPreview?: unknown;
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
  reply?: (result: unknown) => { message: string; state: "COMPLETED" | "WAITING_USER_INPUT"; retryable?: boolean };
}

export interface ToolPolicy {
  enabled?: boolean;
  roles?: RequestUser["role"][];
  requiresConfirmation?: boolean;
}
