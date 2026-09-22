import { llmResponseSchema, type LLMRequest, type ProviderConfig } from "../llm.interface";

export const requestContext = (request: LLMRequest) => JSON.stringify({
  currentTime: new Date().toISOString(), timezone: "Asia/Ho_Chi_Minh",
  goal: request.goal, tools: request.tools, conversation: request.conversation,
});

export async function postJson(url: string, headers: Record<string, string>, body: unknown,
  config: ProviderConfig, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body), signal: AbortSignal.any([signal, AbortSignal.timeout(config.timeoutMs)]),
  });
  // Không đưa response lỗi của nhà cung cấp (có thể chứa thông tin riêng) vào hội thoại/log.
  if (!response.ok) throw new Error("Nhà cung cấp AI tạm thời không khả dụng.");
  const text = await response.text();
  if (text.length > 256_000) throw new Error("Phản hồi AI vượt giới hạn.");
  return JSON.parse(text) as unknown;
}

export function parseReply(text: string) {
  return llmResponseSchema.parse(JSON.parse(text));
}
