import { z } from "zod";
import type { LLMProvider, LLMRequest, ProviderConfig } from "../llm.interface";
import { parseReply, postJson, requestContext } from "./provider-http";

export class GeminiProvider implements LLMProvider {
  constructor(private readonly config: ProviderConfig) {}
  async generate(request: LLMRequest) {
    const data = await postJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.config.model)}:generateContent`,
      { "x-goog-api-key": this.config.apiKey }, {
        systemInstruction: { parts: [{ text: request.system }] },
        contents: [{ role: "user", parts: [{ text: requestContext(request) }] }],
        generationConfig: { temperature: this.config.temperature, maxOutputTokens: 6000, responseMimeType: "application/json" },
      }, this.config, request.signal);
    const parsed = z.object({ candidates: z.array(z.object({ finishReason: z.string(),
      content: z.object({ parts: z.array(z.object({ text: z.string().optional(), thought: z.boolean().optional() })) }),
    })).min(1) }).parse(data);
    if (parsed.candidates[0].finishReason !== "STOP") throw new Error("Phản hồi AI chưa hoàn tất.");
    return parseReply(parsed.candidates[0].content.parts.filter((part) => !part.thought).map((part) => part.text ?? "").join(""));
  }
}
