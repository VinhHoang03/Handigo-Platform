import { AppError } from "../../../utils/appError";
import { knowledgeHash, type KnowledgeConfig } from "../knowledge.config";
import { prepareKnowledgeSource } from "./chunker";
import type { EmbeddingProvider } from "../embeddings/embedding-provider";
import { KnowledgeRepository } from "../knowledge.repository";
import { knowledgeIndexesContain } from "../retrieval/atlas-retriever";

export async function processKnowledgeJob(config: KnowledgeConfig, provider: EmbeddingProvider,
  repository: Pick<KnowledgeRepository, "claim" | "renew" | "version" | "chunks" | "putChunk" | "publish" | "fail">,
  indexContains = knowledgeIndexesContain, signal: AbortSignal = AbortSignal.timeout(180000)) {
  if (provider.generation !== config.generation) throw new AppError("Thế hệ embedding của worker không khớp cấu hình.", 503);
  const job = await repository.claim(config.generation);
  if (!job) return "idle" as const;
  try {
    const version = await repository.version(job.versionId);
    if (!version || !version.approvedBy) throw new AppError("Không tìm thấy nguồn kiến thức đã duyệt.", 409);
    const prepared = prepareKnowledgeSource(version.source, config);
    if (prepared.versionId !== version._id || prepared.checksum !== version.checksum || prepared.documentId !== job.documentId) {
      throw new AppError("Nguồn kiến thức không khớp checksum hoặc công việc.", 409);
    }
    const existing = await repository.chunks(job.versionId, config.generation);
    for (let offset = 0; offset < prepared.chunks.length; offset += 4) {
      signal.throwIfAborted();
      await repository.renew(job);
      const batch = prepared.chunks.slice(offset, offset + 4).filter((chunk) => !existing.some((stored) => stored._id === chunk.id
        && stored.checksum === chunk.checksum && stored.embedding.length === config.dimensions));
      if (!batch.length) continue;
      const vectors = await provider.embed(batch.map((chunk) => `${prepared.source.title}\n${chunk.text}`), "document", signal);
      if (vectors.length !== batch.length || vectors.some((vector) => vector.length !== config.dimensions || !vector.every(Number.isFinite)
        || vector.every((value) => value === 0))) throw new AppError("Lô embedding chưa đủ hoặc không hợp lệ.", 503);
      await repository.renew(job);
      for (let index = 0; index < batch.length; index++) {
        const chunk = batch[index];
        await repository.putChunk({ _id: chunk.id, documentId: prepared.documentId, versionId: prepared.versionId,
          generation: config.generation, ordinal: chunk.ordinal, start: chunk.start, end: chunk.end, text: chunk.text,
          checksum: chunk.checksum, embedding: vectors[index], scope: "CUSTOMER_PUBLIC", topic: prepared.source.topic,
          serviceId: prepared.source.serviceId ?? "all" });
      }
    }
    const complete = await repository.chunks(job.versionId, config.generation);
    if (complete.length !== prepared.chunks.length || prepared.chunks.some((chunk) => !complete.some((stored) => stored._id === chunk.id
      && stored.checksum === knowledgeHash(chunk.text) && stored.text === chunk.text && stored.start === chunk.start && stored.end === chunk.end
      && stored.embedding.length === config.dimensions && stored.embedding.every(Number.isFinite) && stored.embedding.some((value) => value !== 0)))) {
      throw new AppError("Chưa đủ đoạn kiến thức để công bố.", 503);
    }
    await repository.renew(job);
    if (!await indexContains(config, job.versionId, complete.map((chunk) => chunk._id), complete[0].embedding)) {
      throw new AppError("Index chưa đồng bộ đủ nội dung kiến thức.", 503);
    }
    signal.throwIfAborted();
    await repository.publish(job);
    return "processed" as const;
  } catch {
    await repository.fail(job);
    return "retry" as const;
  }
}
