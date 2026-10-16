import { AppError } from "../../utils/appError";
import type { ProviderConfig } from "../llm/llm.interface";

export function quotationAIConfig(): ProviderConfig {
  const apiKey = process.env.QUOTATION_AI_API_KEY?.trim();
  if (!apiKey) throw new AppError("Chưa cấu hình QUOTATION_AI_API_KEY cho AI báo giá.", 503);
  return { apiKey, model: process.env.GEMINI_QUOTATION_MODEL?.trim() || "gemini-2.5-flash", temperature: 0,
    timeoutMs: 30_000 };
}
