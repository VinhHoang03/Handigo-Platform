import { createHash } from "node:crypto";
import { z } from "zod";
import { AppError } from "../../utils/appError";

const schema = z.object({
  provider: z.enum(["gemini", "openai"]), model: z.string().regex(/^[a-z0-9._-]+$/),
  dimensions: z.coerce.number().int().min(128).max(3072),
  timeoutMs: z.coerce.number().int().min(1000).max(60000).default(20000),
  chunkSize: z.coerce.number().int().min(500).max(3000).default(1600),
  chunkOverlap: z.coerce.number().int().min(0).max(300).default(160),
  minVectorScore: z.coerce.number().min(0).max(1).default(0.75),
});
export const knowledgeHash = (value: string) => createHash("sha256").update(value).digest("hex");

export function loadKnowledgeConfig(env: NodeJS.ProcessEnv = process.env) {
  const provider = env.AI_EMBEDDING_PROVIDER || "gemini";
  const model = env.AI_EMBEDDING_MODEL || (provider === "gemini" ? "gemini-embedding-2" : "text-embedding-3-small");
  // Ngưỡng Gemini Embedding 2 được chỉnh bằng tập tuning trên Atlas; model khác cần đánh giá riêng.
  const minVectorScore = provider === "gemini" && model === "gemini-embedding-2" ? 0.855 : 0.75;
  const result = schema.safeParse({ provider, model,
    dimensions: env.AI_EMBEDDING_DIMENSIONS || (provider === "gemini" ? 768 : 1536), timeoutMs: env.AI_EMBEDDING_TIMEOUT_MS,
    chunkSize: env.AI_KNOWLEDGE_CHUNK_SIZE, chunkOverlap: env.AI_KNOWLEDGE_CHUNK_OVERLAP,
    minVectorScore: env.AI_KNOWLEDGE_MIN_VECTOR_SCORE ?? minVectorScore });
  if (!result.success || result.data.chunkOverlap >= result.data.chunkSize) throw new AppError("Cấu hình kho kiến thức chưa hợp lệ.", 503);
  const config = result.data;
  if (config.provider === "gemini" && !["gemini-embedding-2", "gemini-embedding-001"].includes(config.model)
    || config.provider === "openai" && !["text-embedding-3-small", "text-embedding-3-large"].includes(config.model)
    || config.model === "text-embedding-3-small" && config.dimensions > 1536) throw new AppError("Model embedding hoặc số chiều chưa được hỗ trợ.", 503);
  const generation = knowledgeHash(JSON.stringify({ provider: config.provider, model: config.model, dimensions: config.dimensions,
    chunkSize: config.chunkSize, chunkOverlap: config.chunkOverlap, pipeline: "handigo-text-v1" }));
  const vectorIndex = env.AI_KNOWLEDGE_VECTOR_INDEX || `ai_knowledge_vector_${generation.slice(0, 12)}`;
  const textIndex = env.AI_KNOWLEDGE_TEXT_INDEX || "ai_knowledge_text_v1";
  if (![vectorIndex, textIndex].every((name) => /^ai_knowledge_[a-zA-Z0-9_-]{1,100}$/.test(name)) || vectorIndex === textIndex) {
    throw new AppError("Tên index kiến thức phải riêng biệt và có tiền tố ai_knowledge_.", 503);
  }
  return { ...config, generation, vectorIndex, textIndex, enabled: env.AI_KNOWLEDGE_ENABLED === "true" };
}
export type KnowledgeConfig = ReturnType<typeof loadKnowledgeConfig>;
