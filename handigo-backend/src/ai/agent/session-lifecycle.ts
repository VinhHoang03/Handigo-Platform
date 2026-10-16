import type { AgentSession } from "./agent-state";

// Giữ dư địa cho một lượt xử lý trước giới hạn document MongoDB; không hết hạn vì khách rời chat.
export function sessionStorageFull(session: AgentSession) {
  return Buffer.byteLength(JSON.stringify(session), "utf8") >= 8_000_000;
}
