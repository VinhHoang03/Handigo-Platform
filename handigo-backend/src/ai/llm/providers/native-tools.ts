import { z } from "zod";
import { choiceGroupsSchema, llmResponseSchema, type LLMRequest } from "../llm.interface";

const toolSchema = z.object({ name: z.string(), description: z.string(), inputSchema: z.record(z.string(), z.unknown()) });
const responseSchema = z.object({ type: z.enum(["MESSAGE", "FINAL", "ERROR"]), message: z.string().min(1).max(6000),
  choiceGroups: choiceGroupsSchema.optional() }).strict();

export function nativeTools(request: LLMRequest) {
  const tools = request.tools.map((tool) => toolSchema.parse(tool));
  return [...tools, { name: "respond_to_customer", description: "Trả lời khách hoặc hỏi bổ sung khi không cần gọi công cụ khác. Không thông báo tạo đơn/thanh toán thành công nếu chưa có kết quả công cụ xác thực.",
    inputSchema: z.toJSONSchema(responseSchema, { io: "input" }) }].map((tool) => {
    const { $schema: _schema, ...inputSchema } = tool.inputSchema;
    return { ...tool, inputSchema };
  });
}

export function nativeToolReply(name: string, args: unknown) {
  if (name === "respond_to_customer") {
    const response = responseSchema.parse(args);
    return llmResponseSchema.parse(response.type === "MESSAGE" ? response : { type: response.type, message: response.message });
  }
  return llmResponseSchema.parse({ type: "TOOL_CALL", tool: name, arguments: args });
}

export const NATIVE_TOOL_INSTRUCTION = "\nSử dụng function/tool calling được cung cấp để thực hiện bước tiếp theo. Gọi respond_to_customer khi trả lời khách. Chỉ gọi một công cụ mỗi lần. Kết quả công cụ và bản nháp đã được cung cấp trong ngữ cảnh; không lặp hành động thành công.";
