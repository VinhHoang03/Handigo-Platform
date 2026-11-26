import { recordCustomerCache } from "../../runtime/customer-runtime-metrics";
import { knowledgeHash } from "../knowledge.config";
import type { EmbeddingProvider } from "./embedding-provider";

// Chỉ lưu vector của cụm từ công khai đã duyệt, không lưu truy vấn tự do của khách.
const publicQueries = new Set([
  "phương thức thanh toán", "cách thanh toán", "thanh toán payos", "thanh toán qua ví handigo",
  "gửi yêu cầu hỗ trợ", "cách liên hệ handigo", "xem đơn đã đặt", "lịch sử đặt dịch vụ",
  "cách đặt dịch vụ", "cách hủy đơn", "điều hòa rò nước", "điều hòa chảy nước",
]);
const ttlMs = 10 * 60_000;
const maxEntries = 128;
const cache = new Map<string, { vector: number[]; expiresAt: number }>();

export function cacheQueryEmbeddings(provider: EmbeddingProvider): EmbeddingProvider {
  return {
    generation: provider.generation,
    async embed(texts, purpose, signal) {
      const query = texts[0];
      if (purpose !== "query" || texts.length !== 1 || !publicQueries.has(query.normalize("NFC").trim().toLocaleLowerCase("vi-VN"))) {
        return provider.embed(texts, purpose, signal);
      }

      signal.throwIfAborted();
      const key = knowledgeHash(`${provider.generation}:${query}`);
      const entry = cache.get(key);
      if (entry && entry.expiresAt > Date.now()) {
        recordCustomerCache("query_embedding", true);
        return [[...entry.vector]];
      }

      recordCustomerCache("query_embedding", false);
      if (entry) cache.delete(key);
      const vectors = await provider.embed(texts, purpose, signal);
      signal.throwIfAborted();
      const oldest = cache.keys().next().value;
      if (cache.size >= maxEntries && oldest !== undefined) cache.delete(oldest);
      cache.set(key, { vector: [...vectors[0]], expiresAt: Date.now() + ttlMs });
      return vectors;
    },
  };
}
