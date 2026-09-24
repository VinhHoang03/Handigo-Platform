import { z } from "zod";
import type { LLMProvider, LLMRequest, ProviderConfig } from "../llm.interface";
import { parseReply, postJson, requestContext } from "./provider-http";

export class OpenAIProvider implements LLMProvider {
  constructor(private readonly config: ProviderConfig) {}
  async generate(request: LLMRequest) {
    const data = await postJson("https://api.openai.com/v1/chat/completions",
      { Authorization: `Bearer ${this.config.apiKey}` }, {
        model: this.config.model, temperature: this.config.temperature,
        max_completion_tokens: 3000, response_format: { type: "json_object" },
        messages: [{ role: "system", content: request.system }, { role: "user", content: requestContext(request) }],
      }, this.config, request.signal);
    const parsed = z.object({ choices: z.array(z.object({
      finish_reason: z.string(), message: z.object({ content: z.string() }),
    })).min(1) }).parse(data);
    if (parsed.choices[0].finish_reason !== "stop") throw new Error("Phản hồi AI chưa hoàn tất.");
    return parseReply(parsed.choices[0].message.content);
  }
}
