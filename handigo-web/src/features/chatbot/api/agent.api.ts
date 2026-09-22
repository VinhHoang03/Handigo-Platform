import api from "@/api/client";
import { unwrap } from "@/api/response";
import type { AgentRequest, AgentSession } from "../types/agent.types";
export const agentApi = {
  latest: async () => unwrap<AgentSession | null>(await api.get("/ai/sessions/latest")),
  reset: async (sessionId: string) => unwrap<AgentSession>(await api.post("/ai/sessions/reset", { sessionId })),
  send: async (request: AgentRequest) => unwrap<AgentSession>(await api.post("/ai/messages", request, { timeout: 200_000 })),
};
