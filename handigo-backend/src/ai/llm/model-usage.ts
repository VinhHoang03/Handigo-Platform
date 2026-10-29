import { z } from "zod";
import type { LLMRequest, ModelUsage } from "./llm.interface";

const count = z.number().int().nonnegative().max(100_000_000);
export const modelUsageSchema = z.object({ provider: z.enum(["gemini", "openai", "claude"]),
  model: z.string().regex(/^[a-zA-Z0-9./:_-]{1,120}$/), inputTokens: count, outputTokens: count,
  cachedInputTokens: count, cacheWriteTokens: count })
  .refine((usage) => usage.cachedInputTokens + usage.cacheWriteTokens <= usage.inputTokens);

// Thiếu metadata không đồng nghĩa không tốn token; không suy đoán số liệu từ độ dài nội dung.
export function reportModelUsage(request: LLMRequest, provider: ModelUsage["provider"], model: string, data: unknown) {
  if (!request.onUsage || !data || typeof data !== "object") return;
  const body = data as Record<string, unknown>;
  const usage = (provider === "gemini" ? body.usageMetadata : body.usage) as Record<string, unknown> | undefined;
  if (!usage || typeof usage !== "object") return;
  let input: unknown, output: unknown, cached: unknown = 0, written: unknown = 0;
  if (provider === "gemini") {
    if (!count.safeParse(usage.candidatesTokenCount).success
      || usage.thoughtsTokenCount !== undefined && !count.safeParse(usage.thoughtsTokenCount).success) return;
    input = usage.promptTokenCount;
    output = typeof usage.candidatesTokenCount === "number" && (usage.thoughtsTokenCount === undefined || typeof usage.thoughtsTokenCount === "number")
      ? usage.candidatesTokenCount + ((usage.thoughtsTokenCount as number | undefined) ?? 0) : undefined;
    cached = usage.cachedContentTokenCount ?? 0;
  } else if (provider === "openai") {
    input = usage.prompt_tokens; output = usage.completion_tokens;
    cached = (usage.prompt_tokens_details as Record<string, unknown> | undefined)?.cached_tokens ?? 0;
  } else {
    cached = usage.cache_read_input_tokens ?? 0; written = usage.cache_creation_input_tokens ?? 0;
    input = typeof usage.input_tokens === "number" && typeof cached === "number" && typeof written === "number"
      ? usage.input_tokens + cached + written : undefined;
    output = usage.output_tokens;
  }
  const parsed = modelUsageSchema.safeParse({ provider, model, inputTokens: input, outputTokens: output,
    cachedInputTokens: cached, cacheWriteTokens: written });
  if (parsed.success) try { request.onUsage(parsed.data); } catch { /* Lỗi telemetry không làm hỏng phản hồi model. */ }
}
