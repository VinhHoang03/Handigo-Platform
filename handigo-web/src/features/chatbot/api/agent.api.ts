import api from "@/api/client";
import { unwrap } from "@/api/response";
import type { AgentRequest, AgentSession, AgentProgress, AgentSessionHistory } from "../types/agent.types";
export const agentApi = {
  delete: async (sessionId: string) => unwrap<null>(await api.delete(`/ai/sessions/${sessionId}`)),
  list: async (page = 1, signal?: AbortSignal) => unwrap<AgentSessionHistory>(await api.get("/ai/sessions", { params: { page, limit: 20 }, signal })),
  get: async (sessionId: string) => unwrap<AgentSession>(await api.get(`/ai/sessions/${sessionId}`)),
  progress: async (sessionId: string, signal?: AbortSignal) => unwrap<AgentProgress>(await api.get(`/ai/sessions/${sessionId}/progress`, { signal, timeout: 5000 })),
  latest: async () => unwrap<AgentSession | null>(await api.get("/ai/sessions/latest")),
  reset: async (sessionId: string) => unwrap<AgentSession>(await api.post("/ai/sessions/reset", { sessionId })),
  send: async (request: AgentRequest) => unwrap<AgentSession>(await api.post("/ai/messages", request, { timeout: 200_000 })),
};
