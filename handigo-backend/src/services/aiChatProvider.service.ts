import { GoogleGenerativeAI } from "@google/generative-ai";
import { AppError } from "../utils/appError";

export interface AiChatMessage {
  sender: "user" | "assistant";
  content: string;
}

export interface AiChatRequest {
  systemInstruction: string;
  context: string;
  history: AiChatMessage[];
  message: string;
}

interface AiChatProvider {
  generateReply(request: AiChatRequest): Promise<string>;
}

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_TIMEOUT_MS = 20_000;

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number) => {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error("AI provider timeout")),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

class GeminiChatProvider implements AiChatProvider {
  async generateReply(request: AiChatRequest) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new AppError("Trợ lý AI chưa được cấu hình.", 503);
    }

    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: process.env.AI_CHAT_MODEL?.trim() || DEFAULT_MODEL,
      systemInstruction: request.systemInstruction,
      generationConfig: { temperature: 0.25, maxOutputTokens: 800 },
    });
    const history = request.history
      .map((item) => `${item.sender === "user" ? "Người dùng" : "Trợ lý"}: ${item.content}`)
      .join("\n");
    const prompt = [
      `Dữ liệu hệ thống đã kiểm tra:\n${request.context}`,
      history ? `Lịch sử gần đây:\n${history}` : "",
      `Câu hỏi mới:\n${request.message}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    const configuredTimeout = Number(process.env.AI_CHAT_TIMEOUT_MS);
    const timeoutMs =
      Number.isFinite(configuredTimeout) && configuredTimeout > 0
        ? configuredTimeout
        : DEFAULT_TIMEOUT_MS;

    try {
      const result = await withTimeout(model.generateContent(prompt), timeoutMs);
      const reply = result.response.text().trim();
      if (!reply) throw new Error("Empty AI response");
      return reply;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "Trợ lý Handigo tạm thời chưa thể trả lời. Vui lòng thử lại sau.",
        502,
      );
    }
  }
}

export const getAiChatProvider = (): AiChatProvider => {
  const provider = (process.env.AI_CHAT_PROVIDER || "gemini").toLowerCase();
  if (provider !== "gemini") {
    throw new AppError(`Nhà cung cấp AI '${provider}' chưa được hỗ trợ.`, 503);
  }
  return new GeminiChatProvider();
};
