import { newSession, type AgentSession } from "../agent/agent-state";
import type { ReadOnlyGraphData } from "./graph-state";

// Projection dùng một chiều; tuyệt đối không lưu ngược vào phiên engine cũ.
export function projectReadOnlySession(data: ReadOnlyGraphData): AgentSession {
  const session = newSession(data.sessionId, data.userId);
  session.currentGoal = data.turn.message;
  session.state = data.state;
  session.conversation = structuredClone(data.conversation);
  session.receipts = data.receipts.map((receipt) => ({ ...receipt, message: "" }));
  session.activeRequest = data.turn.status === "running" ? {
    requestId: data.turn.requestId, digest: data.turn.digest,
    input: { requestId: data.turn.requestId, message: data.turn.message },
  } : null;
  return session;
}
