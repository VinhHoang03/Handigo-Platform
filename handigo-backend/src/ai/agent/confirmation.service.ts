import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { AppError } from "../../utils/appError";
import type { AgentSession, PendingAction } from "./agent-state";
import type { AgentTool, ToolContext } from "../tools/tool.interface";
import { withAgentTimeout } from "./timeout";

export class ConfirmationService {
  async prepare(tool: AgentTool, context: ToolContext, args: unknown): Promise<PendingAction> {
    const preview = tool.preview ? await withAgentTimeout(tool.preview(context, args), context.signal, 20000) : args;
    return { id: randomUUID(), taskVersion: 0, tool: tool.name, arguments: args, preview: JSON.parse(JSON.stringify(preview)),
      createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(), status: "WAITING_CONFIRMATION" };
  }

  requirePending(session: AgentSession, actionId: string) {
    const pending = session.pendingAction;
    if (!pending || pending.id !== actionId || pending.status !== "WAITING_CONFIRMATION") {
      throw new AppError("Yêu cầu xác nhận không khớp hoặc đã được xử lý.", 409);
    }
    return pending;
  }

  async unchanged(tool: AgentTool, context: ToolContext, action: PendingAction) {
    const args = tool.inputSchema.parse(action.arguments);
    const preview = tool.preview ? await withAgentTimeout(tool.preview(context, args), context.signal, 20000) : args;
    return isDeepStrictEqual(JSON.parse(JSON.stringify(preview)), action.preview);
  }
}
