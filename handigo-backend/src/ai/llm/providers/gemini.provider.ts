import { z } from "zod";
import type { LLMProvider, LLMRequest, ProviderConfig } from "../llm.interface";
import { parseReply, postJson, requestContext } from "./provider-http";
import { nativeTools, nativeToolReply, NATIVE_TOOL_INSTRUCTION } from "./native-tools";

const serverValidatedConstraints = new Set(["pattern", "format", "minimum", "maximum", "exclusiveMinimum",
  "exclusiveMaximum", "multipleOf", "minItems", "maxItems", "uniqueItems", "minLength", "maxLength", "default"]);

// Gemini chỉ cần cấu trúc đầu vào; các giới hạn chi tiết vẫn do Zod kiểm tra trước khi chạy tool.
function geminiToolSchema(schema: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(schema).filter(([key]) => !serverValidatedConstraints.has(key)).map(([key, value]) => {
    if (["properties", "$defs", "definitions"].includes(key) && value && typeof value === "object") {
      return [key, Object.fromEntries(Object.entries(value).map(([name, child]) => [name, geminiToolSchema(child)]))];
    }
    if (["anyOf", "oneOf", "allOf", "prefixItems"].includes(key) && Array.isArray(value)) {
      return [key, value.map((child) => geminiToolSchema(child))];
    }
    if (["items", "additionalProperties"].includes(key) && value && typeof value === "object" && !Array.isArray(value)) {
      return [key, geminiToolSchema(value as Record<string, unknown>)];
    }
    return [key, value];
  }));
}

export class GeminiProvider implements LLMProvider {
  constructor(private readonly config: ProviderConfig) {}
  async generate(request: LLMRequest) {
    const model = this.config.model.trim().replace(/^models\//, "");
    const data = await postJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      { "x-goog-api-key": this.config.apiKey }, {
        systemInstruction: { parts: [{ text: request.system + NATIVE_TOOL_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: requestContext(request) }] }],
        tools: [{ functionDeclarations: nativeTools(request).map((tool) => ({
          name: tool.name, description: tool.description, parametersJsonSchema: geminiToolSchema(tool.inputSchema),
        })) }],
        toolConfig: { functionCallingConfig: { mode: "ANY" } },
        generationConfig: { temperature: this.config.temperature, maxOutputTokens: 6000 },
      }, this.config, request.signal);
    const parsed = z.object({ candidates: z.array(z.object({ finishReason: z.string(),
      content: z.object({ parts: z.array(z.object({ text: z.string().optional(), thought: z.boolean().optional(),
        functionCall: z.object({ name: z.string(), args: z.record(z.string(), z.unknown()).optional() }).optional() })) }),
    })).min(1) }).parse(data);
    if (parsed.candidates[0].finishReason !== "STOP") throw new Error("Phản hồi AI chưa hoàn tất.");
    const calls = parsed.candidates[0].content.parts.flatMap((part) => part.functionCall ? [part.functionCall] : []);
    if (calls.length === 1) return nativeToolReply(calls[0].name, calls[0].args ?? {});
    if (calls.length > 1) throw new Error("AI cần gọi một công cụ mỗi lần để bảo đảm thứ tự xử lý.");
    return parseReply(parsed.candidates[0].content.parts.filter((part) => !part.thought).map((part) => part.text ?? "").join(""));
  }
}
