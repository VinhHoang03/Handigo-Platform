import api from "@/api/client";
import type { Assessment, Config, Feature, Policy, SourceType, ComplaintDecision } from "./adminAI.types";
const data = <T>(response: { data: { data: T } }) => response.data.data;
export const adminAI = {
  configs: async () => data<{ configured: boolean; configs: Config[] }>(await api.get("/ai/admin/configs")),
  save: async (feature: Feature, revision: number, draft: Policy) => data<Config>(await api.put(`/ai/admin/configs/${feature}`, { revision, draft })),
  activate: async (feature: Feature, revision: number, enabled: boolean) => data<Config>(await api.post(`/ai/admin/configs/${feature}/activation`, { revision, enabled })),
  history: async (feature: Feature) => data<Array<{ revision: number; action: string; createdAt: string; actorId: string }>>(await api.get(`/ai/admin/configs/${feature}/history`)),
  run: async (input: { feature: Feature; sourceType: SourceType; sourceId: string; preview: boolean; from?: string; to?: string }) => data<Assessment>(await api.post("/ai/admin/assessments", input)),
  sources: async (type: SourceType, email?: string) => data<Array<{ id: string; label: string; status: string }>>(await api.get("/ai/admin/sources", { params: { type, email } })),
  list: async (feature: Feature, page: number, status?: string, sourceId?: string) => data<{ items: Assessment[]; totalPages: number; total: number }>(await api.get("/ai/admin/assessments", { params: { feature, page, limit: 5, status: status || undefined, sourceId } })),
  decideComplaint: async (id: string, input: ComplaintDecision) => data<{ assessmentId: string; sourceId: string; status: string }>(await api.post(`/ai/admin/assessments/${id}/complaint-decision`, input)),
};
