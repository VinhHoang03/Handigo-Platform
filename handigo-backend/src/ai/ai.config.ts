import { z } from "zod";
import { AppError } from "../utils/appError";
import { AGENT_PROMPT } from "./agent/agent-prompt";
import type { LLMProvider, ProviderConfig } from "./llm/llm.interface";
import { OpenAIProvider } from "./llm/providers/openai.provider";
import { GeminiProvider } from "./llm/providers/gemini.provider";
import { ClaudeProvider } from "./llm/providers/claude.provider";

const factories: Record<string, (config: ProviderConfig) => LLMProvider> = {
  openai: (config) => new OpenAIProvider(config),
  gemini: (config) => new GeminiProvider(config),
  claude: (config) => new ClaudeProvider(config),
};
const configSchema = z.object({
  provider: z.string().min(1), model: z.string().min(1), apiKey: z.string().min(1),
  temperature: z.coerce.number().min(0).max(1).default(0.2),
  maxIterations: z.coerce.number().int().min(1).max(20).default(8),
  timeoutMs: z.coerce.number().int().min(1000).max(60000).default(20000),
  tools: z.record(z.string(), z.object({ enabled: z.boolean().optional(),
    roles: z.array(z.enum(["CUSTOMER", "PROVIDER", "ADMIN"])).optional(),
    requiresConfirmation: z.boolean().optional() }).strict()).default({}),
});

export function loadAgentConfig() {
  const provider = (process.env.AI_AGENT_PROVIDER || process.env.AI_CHAT_PROVIDER || "gemini").toLowerCase();
  const keyNames: Record<string, string> = { gemini: "GEMINI_API_KEY", openai: "OPENAI_API_KEY", claude: "ANTHROPIC_API_KEY" };
  let tools: unknown;
  try { tools = JSON.parse(process.env.AI_AGENT_TOOLS || "{}"); }
  catch { throw new AppError("Cấu hình tool AI không hợp lệ.", 503); }
  const result = configSchema.safeParse({ provider,
    model: process.env.AI_AGENT_MODEL || (provider === "gemini" ? process.env.AI_CHAT_MODEL || "gemini-2.5-flash" : undefined),
    apiKey: process.env[keyNames[provider]], temperature: process.env.AI_AGENT_TEMPERATURE,
    maxIterations: process.env.AI_AGENT_MAX_ITERATIONS, timeoutMs: process.env.AI_AGENT_TIMEOUT_MS, tools,
  });
  if (!result.success || !factories[provider]) throw new AppError("Trợ lý AI chưa được cấu hình hợp lệ.", 503);
  return { ...result.data, systemPrompt: `${AGENT_PROMPT}\n${process.env.AI_AGENT_SYSTEM_PROMPT || ""}`,
    createProvider: () => factories[provider](result.data) };
}
