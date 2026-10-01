import { z } from "zod";
import type { AgentMessage } from "../agent/agent-state";

export const choiceGroupsSchema = z.array(z.object({
  label: z.string().trim().min(1).max(120),
  multiple: z.boolean().default(false),
  options: z.array(z.string().trim().min(1).max(160)).min(1).max(12),
}).strict()).max(6);
export type AgentChoiceGroup = z.infer<typeof choiceGroupsSchema>[number];

export const llmResponseSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("MESSAGE"), message: z.string().min(1).max(6000), choiceGroups: choiceGroupsSchema.optional() }).strict(),
  z.object({ type: z.literal("TOOL_CALL"), tool: z.string().min(1).max(80), arguments: z.record(z.string(), z.unknown()) }).strict(),
  z.object({ type: z.literal("FINAL"), message: z.string().min(1).max(6000) }).strict(),
  z.object({ type: z.literal("ERROR"), message: z.string().min(1).max(6000) }).strict(),
]);
export type LLMResponse = z.infer<typeof llmResponseSchema>;
export interface LLMRequest {
  taskContext?: unknown;
  system: string;
  goal: string;
  conversation: AgentMessage[];
  tools: unknown[];
  signal: AbortSignal;
}
export interface LLMProvider {
  generate(request: LLMRequest): Promise<LLMResponse>;
}
export interface ProviderConfig {
  apiKey: string;
  model: string;
  temperature: number;
  timeoutMs: number;
}
