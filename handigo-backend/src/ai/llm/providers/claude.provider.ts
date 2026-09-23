import { z } from "zod";
import type { LLMProvider, LLMRequest, ProviderConfig } from "../llm.interface";
import { parseReply, postJson, requestContext } from "./provider-http";

export class ClaudeProvider implements LLMProvider {
  constructor(private readonly config: ProviderConfig) {}
  async generate(request: LLMRequest) {
    const data = await postJson("https://api.anthropic.com/v1/messages",
      { "x-api-key": this.config.apiKey, "anthropic-version": "2023-06-01" }, {
        model: this.config.model, temperature: this.config.temperature, max_tokens: 3000,
        system: request.system, messages: [{ role: "user", content: requestContext(request) }],
      }, this.config, request.signal);
    const parsed = z.object({ stop_reason: z.string(), content: z.array(z.object({ type: z.string(), text: z.string().optional() })) }).parse(data);
    if (parsed.stop_reason !== "end_turn") throw new Error("Phản hồi AI chưa hoàn tất.");
    return parseReply(parsed.content.filter((block) => block.type === "text").map((block) => block.text ?? "").join(""));
  }
}
