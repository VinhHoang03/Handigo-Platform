import type { AgentSession } from "./agent-state";

export const SESSION_IDLE_MS = 30 * 60 * 1000;

export function sessionLifecycle(session: AgentSession, now = Date.now()) {
  const protectedSession = Boolean(session.pendingAction || session.activeRequest || session.requiresReconciliation)
    || session.actions.some((action) => action.status === "UNKNOWN");
  const lastMessage = session.conversation[session.conversation.length - 1];
  const lastActivity = lastMessage ? Date.parse(lastMessage.createdAt) : NaN;
  const expiresAt = !protectedSession && Number.isFinite(lastActivity)
    ? new Date(lastActivity + SESSION_IDLE_MS).toISOString() : null;
  return { expiresAt, expired: expiresAt !== null && now >= Date.parse(expiresAt) };
}
