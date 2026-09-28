import { z } from "zod";
import type { LLMProvider, LLMRequest, ProviderConfig } from "../llm.interface";
import { parseReply, postJson, requestContext } from "./provider-http";
import { nativeTools, nativeToolReply, NATIVE_TOOL_INSTRUCTION } from "./native-tools";

export class ClaudeProvider implements LLMProvider {
  constructor(private readonly config: ProviderConfig) {}
  async generate(request: LLMRequest) {
    // Claude từ 4.7 và Mythos chỉ nhận giá trị sampling mặc định.
    const version = /^claude-(?:opus|sonnet|haiku)-(\d+)(?:-(\d{1,2})(?:-|$))?/.exec(this.config.model);
    const supportsTemperature = !this.config.model.startsWith("claude-mythos-")
      && !(version && (Number(version[1]) >= 5 || (Number(version[1]) === 4 && Number(version[2]) >= 7)));
    const data = await postJson("https://api.anthropic.com/v1/messages",
      { "x-api-key": this.config.apiKey, "anthropic-version": "2023-06-01" }, {
        model: this.config.model, ...(supportsTemperature ? { temperature: this.config.temperature } : {}), max_tokens: 3000,
        system: request.system + NATIVE_TOOL_INSTRUCTION, messages: [{ role: "user", content: requestContext(request) }],
        tools: nativeTools(request).map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.inputSchema })),
        tool_choice: { type: "auto", disable_parallel_tool_use: true },
      }, this.config, request.signal);
    const parsed = z.object({ stop_reason: z.string(), content: z.array(z.object({ type: z.string(), text: z.string().optional(),
      name: z.string().optional(), input: z.unknown().optional() })) }).parse(data);
    const calls = parsed.content.filter((block) => block.type === "tool_use");
    if (parsed.stop_reason === "tool_use" && calls.length === 1 && calls[0].name) return nativeToolReply(calls[0].name, calls[0].input);
    if (parsed.stop_reason !== "end_turn") throw new Error("Phản hồi AI chưa hoàn tất.");
    return parseReply(parsed.content.filter((block) => block.type === "text").map((block) => block.text ?? "").join(""));
  }
}
