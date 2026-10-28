import { z } from "zod";
import { AppError } from "../../../utils/appError";
import { withAgentTimeout } from "../../agent/timeout";
import type { KnowledgeConfig } from "../knowledge.config";

export interface EmbeddingProvider {
  readonly generation: string;
  embed(texts: string[], purpose: "document" | "query", signal: AbortSignal): Promise<number[][]>;
}

// Không log phản hồi HTTP, khóa API hoặc văn bản đầu vào của dịch vụ embedding.
export function createEmbeddingProvider(config: KnowledgeConfig, env: NodeJS.ProcessEnv = process.env,
  request: typeof fetch = fetch): EmbeddingProvider {
  const apiKey = env[config.provider === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY"];
  if (!apiKey) throw new AppError("Chưa cấu hình khóa API embedding.", 503);
  const vectorSchema = z.array(z.number().finite()).length(config.dimensions);
  const normalize = (value: unknown) => {
    const vector = vectorSchema.parse(value);
    const norm = Math.hypot(...vector);
    if (!Number.isFinite(norm) || norm === 0) throw new AppError("Dịch vụ embedding trả vector không hợp lệ.", 503);
    return vector.map((item) => item / norm);
  };
  return { generation: config.generation, async embed(texts, purpose, parentSignal) {
    if (!texts.length || texts.length > 32 || texts.some((text) => !text.trim() || text.length > 16000)) {
      throw new AppError("Lô văn bản embedding không hợp lệ.", 400);
    }
    const signal = AbortSignal.any([parentSignal, AbortSignal.timeout(config.timeoutMs)]);
    const post = async (url: string, headers: Record<string, string>, body: unknown) => {
      signal.throwIfAborted();
      const response = await request(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body), signal });
      if (!response.ok) { await response.body?.cancel(); throw new AppError("Dịch vụ embedding tạm thời không khả dụng.", 503); }
      const reader = response.body?.getReader();
      if (!reader) throw new AppError("Dịch vụ embedding không trả nội dung.", 503);
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          signal.throwIfAborted();
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 2_000_000) throw new AppError("Phản hồi embedding vượt giới hạn.", 503);
          chunks.push(value);
        }
      } finally { await reader.cancel().catch(() => undefined); }
      return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
    };
    const operation = async () => {
      if (config.provider === "gemini") {
        // Mỗi đoạn một request để tránh Embedding 2 gộp nhiều đoạn thành một vector.
        const vectors: number[][] = [];
        for (const text of texts) {
          const secondGeneration = config.model === "gemini-embedding-2";
          const input = secondGeneration ? purpose === "query" ? `task: search result | query: ${text}` : `title: none | text: ${text}` : text;
          const result = await post(`https://generativelanguage.googleapis.com/v1beta/models/${config.model}:embedContent`, { "x-goog-api-key": apiKey }, {
            model: `models/${config.model}`, content: { parts: [{ text: input }] },
            embedContentConfig: { outputDimensionality: config.dimensions, autoTruncate: false,
              ...(!secondGeneration ? { taskType: purpose === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT" } : {}) },
          });
          vectors.push(normalize(z.object({ embedding: z.object({ values: vectorSchema }) }).parse(result).embedding.values));
        }
        return vectors;
      }
      const result = await post("https://api.openai.com/v1/embeddings", { Authorization: `Bearer ${apiKey}` },
        { model: config.model, input: texts, dimensions: config.dimensions, encoding_format: "float" });
      const rows = z.object({ data: z.array(z.object({ index: z.number().int().nonnegative(), embedding: vectorSchema })).length(texts.length) }).parse(result).data;
      const sorted = [...rows].sort((a, b) => a.index - b.index);
      if (sorted.some((row, index) => row.index !== index)) throw new AppError("Thứ tự kết quả embedding không hợp lệ.", 503);
      return sorted.map((row) => normalize(row.embedding));
    };
    return withAgentTimeout(operation(), signal, config.timeoutMs);
  } };
}
