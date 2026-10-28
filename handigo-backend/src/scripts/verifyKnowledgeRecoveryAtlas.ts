import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import mongoose from "mongoose";
import { z } from "zod";
import { loadKnowledgeConfig, knowledgeHash } from "../ai/knowledge/knowledge.config";
import { prepareKnowledgeSource } from "../ai/knowledge/ingestion/chunker";
import { processKnowledgeJob } from "../ai/knowledge/ingestion/indexing-worker";
import { KnowledgeRepository } from "../ai/knowledge/knowledge.repository";
import { createEmbeddingProvider, type EmbeddingProvider } from "../ai/knowledge/embeddings/embedding-provider";
import { requireKnowledgeIndexes, retrieveAtlasKnowledge } from "../ai/knowledge/retrieval/atlas-retriever";
import { AiKnowledgeDocument, AiKnowledgeJob, AiKnowledgeChunk } from "../models/aiKnowledge.model";

// Generation fixture riêng dùng cùng index, không thuộc generation mà khách hàng đang truy xuất.
// Không xóa dữ liệu hoặc thay manifest của 15 nguồn nghiệp vụ đã công bố.
export async function verifyKnowledgeRecoveryAtlas(uri: string, apiKey: string) {
  const repository = new KnowledgeRepository();
  let documentId: string | undefined;
  try {
    await mongoose.connect(uri, { autoCreate: false, autoIndex: false, serverSelectionTimeoutMS: 12000 });
    const runId = randomUUID();
    const base = loadKnowledgeConfig();
    const config = { ...base, generation: knowledgeHash(`fixture-recovery:${runId}`) };
    const published = (value: unknown) => z.record(z.string(), z.string()).parse(value instanceof Map ? Object.fromEntries(value) : value ?? {})[config.generation];
    await requireKnowledgeIndexes(config);
    const underlying = createEmbeddingProvider(config, { GEMINI_API_KEY: apiKey });
    let documentEmbeddings = 0;
    const provider: EmbeddingProvider = { generation: config.generation, async embed(texts, purpose, signal) {
      if (purpose === "document") documentEmbeddings += texts.length;
      return underlying.embed(texts, purpose, signal);
    } };
    const prepare = (version: string) => prepareKnowledgeSource({ sourceKey: `fixture/recovery/${runId}`,
      title: `Nguồn kiểm chứng riêng ${runId}`, topic: "support", source: "Fixture phục hồi worker Atlas", path: "/customer/support",
      content: `Mã kiểm chứng ${runId}. Đây là tài liệu phiên bản ${version} để kiểm tra hạ tầng AI, không phải chính sách khách hàng.` }, config);
    const first = prepare("một");
    documentId = first.documentId;
    const jobId = await repository.enqueue(first, config, "kiem-thu-recovery");
    const stale = await repository.claim(config.generation);
    assert.ok(stale && stale._id === jobId);
    const [vector] = await provider.embed([`${first.source.title}\n${first.chunks[0].text}`], "document", AbortSignal.timeout(25000));
    const chunk = first.chunks[0];
    await repository.putChunk({ _id: chunk.id, documentId, versionId: first.versionId, generation: config.generation,
      ordinal: chunk.ordinal, start: chunk.start, end: chunk.end, text: chunk.text, checksum: chunk.checksum,
      embedding: vector, scope: "CUSTOMER_PUBLIC", topic: "support", serviceId: "all" });
    // Fault injection: worker dừng sau ghi chunk, không fail/publish; ép hết lease chỉ trên job fixture.
    await AiKnowledgeJob.updateOne({ _id: jobId, leaseId: stale.leaseId }, { $set: { leaseUntil: new Date(0), nextAttemptAt: new Date(0) } }, { runValidators: true });
    await assert.rejects(repository.renew(stale));
    const finish = async (id: string) => {
      const deadline = Date.now() + 60000;
      while (Date.now() < deadline) {
        const job = await AiKnowledgeJob.findById(id).lean();
        if (job?.status === "ready") return;
        if (job?.status === "failed") await repository.retry(id);
        await AiKnowledgeJob.updateOne({ _id: id, generation: config.generation, status: "pending" },
          { $set: { nextAttemptAt: new Date(0) } }, { runValidators: true });
        const status = await processKnowledgeJob(config, provider, repository);
        if (status === "processed") return;
        await delay(2000);
      }
      throw new Error("Index fixture chưa đồng bộ trong giới hạn kiểm chứng.");
    };
    await finish(jobId);
    assert.equal(documentEmbeddings, 1, "Tiếp tục phải dùng lại embedding đã lưu.");
    await assert.rejects(repository.publish(stale));
    let articles = await retrieveAtlasKnowledge(runId, "support", config, provider, AbortSignal.timeout(25000));
    assert.ok(articles.some((article) => article.source.includes(first.versionId.slice(0, 12))));
    const second = prepare("hai");
    const secondJob = await repository.enqueue(second, config, "kiem-thu-recovery");
    await finish(secondJob);
    articles = await retrieveAtlasKnowledge(runId, "support", config, provider, AbortSignal.timeout(25000));
    assert.ok(articles.length > 0 && articles.every((article) => article.source.includes(second.versionId.slice(0, 12))));
    assert.ok(articles.every((article) => !article.content.includes("phiên bản một")));
    const obsolete = prepare("ba");
    await repository.enqueue(obsolete, config, "kiem-thu-recovery");
    const obsoleteJob = await repository.claim(config.generation);
    assert.ok(obsoleteJob && obsoleteJob.versionId === obsolete.versionId);
    await repository.enqueue(second, config, "kiem-thu-recovery");
    await repository.publish(obsoleteJob);
    assert.equal((await AiKnowledgeJob.findById(obsoleteJob._id).lean())?.status, "superseded");
    let manifest = await AiKnowledgeDocument.findById(documentId).lean();
    assert.equal(published(manifest?.publications), second.versionId);
    const fourth = prepare("bốn");
    await repository.enqueue(fourth, config, "kiem-thu-recovery");
    const revokedJob = await repository.claim(config.generation);
    assert.ok(revokedJob && revokedJob.versionId === fourth.versionId);
    const stored = await AiKnowledgeChunk.countDocuments({ documentId, generation: config.generation });
    await repository.revoke(documentId);
    await repository.publish(revokedJob);
    assert.equal((await AiKnowledgeJob.findById(revokedJob._id).lean())?.status, "superseded");
    articles = await retrieveAtlasKnowledge(runId, "support", config, provider, AbortSignal.timeout(25000));
    assert.equal(articles.length, 0, "Thu hồi phải chặn nguồn kể cả chunk/index vẫn còn.");
    assert.equal(await AiKnowledgeChunk.countDocuments({ documentId, generation: config.generation }), stored);
    manifest = await AiKnowledgeDocument.findById(documentId).lean();
    assert.equal(published(manifest?.publications), second.versionId);
    assert.equal(manifest?.status, "revoked");
    return { recoveredExpiredWorker: true, reusedEmbedding: true, stalePublishBlocked: true, newVersionOnly: true,
      obsoleteJobSuperseded: true, revokedJobSuperseded: true, staleIndexRevocationSafe: true,
      isolatedGeneration: config.generation, documentEmbeddings, businessWrites: 0, deletedDocuments: 0 };
  } finally {
    try { if (documentId) await repository.revoke(documentId); }
    finally { await mongoose.disconnect(); }
  }
}

if (require.main === module) {
  void (async () => {
    if (!process.env.MONGO_URI || !process.env.GEMINI_API_KEY) throw new Error("Cần MONGO_URI/GEMINI_API_KEY được cấp cho tiến trình; không tự đọc .env.");
    console.log(JSON.stringify(await verifyKnowledgeRecoveryAtlas(process.env.MONGO_URI, process.env.GEMINI_API_KEY)));
  })().catch((error: unknown) => { console.error("Kiểm chứng recovery kiến thức chưa đạt.", { type: error instanceof Error ? error.name : "unknown" }); process.exitCode = 1; });
}
