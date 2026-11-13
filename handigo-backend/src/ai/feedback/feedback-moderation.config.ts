import { AppError } from "../../utils/appError";
import type { ProviderConfig } from "../llm/llm.interface";

export function feedbackModerationAIConfig(env: NodeJS.ProcessEnv = process.env): ProviderConfig {
  const apiKey = env.FEEDBACK_MODERATION_API_KEY?.trim();
  const model = env.FEEDBACK_MODERATION_MODEL?.trim().replace(/^models\//, "");
  if (!apiKey || !model) {
    throw new AppError("Chưa cấu hình đầy đủ AI kiểm duyệt đánh giá.", 503);
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(model)) {
    throw new AppError("Tên mô hình AI kiểm duyệt đánh giá không hợp lệ.", 503);
  }
  return { apiKey, model, temperature: 0, timeoutMs: 12000 };
}
