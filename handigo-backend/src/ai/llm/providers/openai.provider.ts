import { z } from "zod";
import type { LLMProvider, LLMRequest, ProviderConfig } from "../llm.interface";
import { parseReply, postJson, requestContext } from "./provider-http";
import { nativeTools, nativeToolReply, NATIVE_TOOL_INSTRUCTION } from "./native-tools";

export class OpenAIProvider implements LLMProvider {
  constructor(private readonly config: ProviderConfig) {}
  async generate(request: LLMRequest) {
    // Các model suy luận này không nhận temperature tùy chỉnh.
    const supportsTemperature = !/^(?:o[134](?:-|$)|gpt-5(?:-(?:mini|nano))?(?:$|-\d{4}-\d{2}-\d{2}$))/.test(this.config.model);
    const data = await postJson("https://api.openai.com/v1/chat/completions",
      { Authorization: `Bearer ${this.config.apiKey}` }, {
        model: this.config.model, ...(supportsTemperature ? { temperature: this.config.temperature } : {}),
        max_completion_tokens: 3000, parallel_tool_calls: false, tool_choice: "required",
        tools: nativeTools(request).map((tool) => ({ type: "function", function: {
          name: tool.name, description: tool.description, parameters: tool.inputSchema, strict: false,
        } })),
        messages: [{ role: "system", content: request.system + NATIVE_TOOL_INSTRUCTION }, { role: "user", content: requestContext(request) }],
      }, this.config, request.signal);
    const parsed = z.object({ choices: z.array(z.object({
      finish_reason: z.string(), message: z.object({ content: z.string().nullable().optional(),
        tool_calls: z.array(z.object({ type: z.literal("function"), function: z.object({ name: z.string(), arguments: z.string() }) })).optional() }),
    })).min(1) }).parse(data);
    const choice = parsed.choices[0];
    if (choice.finish_reason === "tool_calls" && choice.message.tool_calls?.length === 1) {
      const call = choice.message.tool_calls[0].function;
      return nativeToolReply(call.name, JSON.parse(call.arguments));
    }
    if (choice.finish_reason !== "stop" || choice.message.tool_calls?.length) throw new Error("Phản hồi AI chưa hoàn tất hoặc gọi nhiều công cụ cùng lúc.");
    return parseReply(choice.message.content ?? "");
  }
}
