import api from "@/api/client";
import { unwrap } from "@/api/response";
import type { AgentRequest, AgentSession, AgentProgress } from "../types/agent.types";
export const agentApi = {
  progress: async (sessionId: string, signal?: AbortSignal) => unwrap<AgentProgress>(await api.get(`/ai/sessions/${sessionId}/progress`, { signal, timeout: 5000 })),
  latest: async () => unwrap<AgentSession | null>(await api.get("/ai/sessions/latest")),
  reset: async (sessionId: string) => unwrap<AgentSession>(await api.post("/ai/sessions/reset", { sessionId })),
  send: async (request: AgentRequest) => unwrap<AgentSession>(await api.post("/ai/messages", request, { timeout: 200_000 })),
};
