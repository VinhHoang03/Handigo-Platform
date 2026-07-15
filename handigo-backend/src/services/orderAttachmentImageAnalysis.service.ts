import { GoogleGenerativeAI } from "@google/generative-ai";

export interface OrderAttachmentImageAnalysisResult {
  isRelevant: boolean;
  confidence: number;
  reason: string;
  detectedObjects: string[];
}

const DEFAULT_MODEL = "gemini-2.5-flash";
const MIN_ACCEPTED_CONFIDENCE = 0.65;

const getGeminiApiKey = () => process.env.GEMINI_API_KEY?.trim();

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
    throw new Error("Thiếu cấu hình GEMINI_API_KEY");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_IMAGE_VALIDATION_MODEL || DEFAULT_MODEL,
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
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: buffer.toString("base64"),
          mimeType,
        },
      },
    ]);

    const text = result.response.text();
    const parsed = JSON.parse(extractJsonObject(text));
    analysis = normalizeAnalysis(parsed);
  } catch {
    throw new Error("Gemini không thể phân tích ảnh");
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
