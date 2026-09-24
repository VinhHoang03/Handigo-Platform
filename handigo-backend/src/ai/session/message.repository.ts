import { randomUUID } from "node:crypto";
import type { AgentMessage, AgentSession } from "../agent/agent-state";

// Hội thoại được checkpoint cùng trạng thái trong một document để tránh lệch ngữ cảnh.
export class MessageRepository {
  append(session: AgentSession, role: AgentMessage["role"], content: string, tool?: string) {
    session.conversation.push({ id: randomUUID(), role, content, tool, createdAt: new Date().toISOString() });
  }
}
