import { GoogleGenerativeAI, GoogleGenerativeAIFetchError } from "@google/generative-ai";
import { AppError } from "../utils/appError";
import { createLogger } from "../utils/logger";
import { setTimeout as delay } from "node:timers/promises";

export interface OrderAttachmentImageAnalysisResult {
  isRelevant: boolean;
  confidence: number;
  reason: string;
  detectedObjects: string[];
}

const IMAGE_VALIDATION_MODEL = "gemini-3.5-flash-lite";
const MIN_ACCEPTED_CONFIDENCE = 0.65;
const imageAnalysisLogger = createLogger("OrderAttachmentImageAnalysis");

const getGeminiApiKey = () =>
  process.env.GEMINI_API_KEY_1?.trim() || process.env.GEMINI_API_KEY?.trim();

const extractJsonObject = (text: string) => {
  const cleaned = text.replace(/```json|```/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Gemini không trả về JSON hợp lệ");
  }
  return cleaned.slice(start, end + 1);
};

const normalizeAnalysis = (value: unknown): OrderAttachmentImageAnalysisResult => {
  const data = value as Partial<OrderAttachmentImageAnalysisResult>;
  return {
    isRelevant: Boolean(data.isRelevant),
    confidence: typeof data.confidence === "number" ? data.confidence : 0,
    reason:
      typeof data.reason === "string" && data.reason.trim()
        ? data.reason.trim()
        : "Ảnh chưa thể hiện rõ thiết bị, máy móc hư hỏng hoặc khu vực cần sửa.",
    detectedObjects: Array.isArray(data.detectedObjects)
      ? data.detectedObjects.filter((item): item is string => typeof item === "string")
      : [],
  };
};

export const analyzeOrderProblemImage = async (
  buffer: Buffer,
  mimeType: string,
): Promise<OrderAttachmentImageAnalysisResult> => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new AppError("Hệ thống chưa cấu hình dịch vụ kiểm tra ảnh. Vui lòng liên hệ hỗ trợ.", 503);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: IMAGE_VALIDATION_MODEL,
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  });

  const prompt = [
    "Bạn là bộ lọc ảnh cho nền tảng đặt dịch vụ sửa chữa tại nhà Handigo.",
    "Hãy đánh giá ảnh khách hàng tải lên có phù hợp làm ảnh hiện trạng sự cố hay không.",
    "Chấp nhận nếu ảnh thể hiện rõ một trong các nhóm: thiết bị gia dụng, máy móc, đồ điện, điện nước, nội thất, khu vực nhà ở/công trình có hư hỏng, rò rỉ, nứt vỡ, bẩn, cần lắp đặt, cần vệ sinh hoặc cần sửa chữa.",
    "Từ chối nếu ảnh chủ yếu là selfie/chân dung/người tạo dáng, đồ ăn, thú cưng, phong cảnh, ảnh màn hình, giấy tờ, ảnh quảng cáo, ảnh quá mơ hồ hoặc không liên quan đến vấn đề dịch vụ tại nhà.",
    "Nếu ảnh có người nhưng trọng tâm vẫn là thiết bị hoặc khu vực hư hỏng thì có thể chấp nhận.",
    "Chỉ trả về JSON đúng schema: {\"isRelevant\": boolean, \"confidence\": number, \"reason\": string, \"detectedObjects\": string[] }.",
    "reason phải viết tiếng Việt ngắn gọn, hướng tới khách hàng.",
  ].join(" ");

  let analysis: OrderAttachmentImageAnalysisResult;

  try {
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: buffer.toString("base64"),
              mimeType,
            },
          },
        ], { timeout: 20_000 });

        const text = result.response.text();
        const parsed = JSON.parse(extractJsonObject(text));
        analysis = normalizeAnalysis(parsed);
        break;
      } catch (error) {
        const status = error instanceof GoogleGenerativeAIFetchError ? error.status : undefined;
        if (attempt >= 2 || ![502, 503, 504].includes(status ?? 0)) throw error;
        const retryDelayMs = 1000 * 2 ** attempt;
        imageAnalysisLogger.warn("Dịch vụ kiểm tra ảnh tạm gián đoạn, đang thử lại.", {
          upstreamStatus: status,
          nextAttempt: attempt + 2,
          retryDelayMs,
        });
        await delay(retryDelayMs);
      }
    }
  } catch (error) {
    const status = error instanceof GoogleGenerativeAIFetchError ? error.status : undefined;
    imageAnalysisLogger.error("Kiểm tra ảnh mô tả thất bại.", undefined, {
      model: IMAGE_VALIDATION_MODEL,
      upstreamStatus: status,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    let message = "Dịch vụ kiểm tra ảnh đang gặp sự cố. Vui lòng thử lại sau.";
    if (status === 400 || status === 401 || status === 403) {
      message = "Dịch vụ kiểm tra ảnh đang lỗi cấu hình hoặc quyền truy cập. Vui lòng liên hệ hỗ trợ.";
    } else if (status === 404) {
      message = "Mô hình kiểm tra ảnh hiện không khả dụng. Vui lòng liên hệ hỗ trợ.";
    } else if (status === 429) {
      message = "Dịch vụ kiểm tra ảnh đang quá hạn mức. Vui lòng thử lại sau.";
    }
    throw new AppError(message, 503);
  }

  if (analysis.confidence < MIN_ACCEPTED_CONFIDENCE) {
    return {
      ...analysis,
      isRelevant: false,
      reason:
        analysis.reason ||
        "Ảnh chưa đủ rõ để xác nhận liên quan đến thiết bị, máy móc hư hỏng hoặc khu vực cần sửa.",
    };
  }

  return analysis;
};
