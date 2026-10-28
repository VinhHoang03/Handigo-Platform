import assert from "node:assert/strict";
import { mock } from "node:test";
import { AiKnowledgeChunk as Chunks, AiKnowledgeDocument as Documents, AiKnowledgeVersion as Versions } from "../models/aiKnowledge.model";
import { loadKnowledgeConfig } from "../ai/knowledge/knowledge.config";
import { prepareKnowledgeSource } from "../ai/knowledge/ingestion/chunker";
import { builtinKnowledgeSources } from "../ai/knowledge/ingestion/builtin-sources";
import { retrieveAtlasKnowledge, knowledgeIndexDefinitions } from "../ai/knowledge/retrieval/atlas-retriever";

async function run() {
  const config = loadKnowledgeConfig({ AI_EMBEDDING_DIMENSIONS: "128" });
  assert.equal(config.minVectorScore, 0.855);
  assert.equal(loadKnowledgeConfig({ AI_EMBEDDING_MODEL: "gemini-embedding-001" }).minVectorScore, 0.75);
  assert.equal(loadKnowledgeConfig({ AI_EMBEDDING_PROVIDER: "openai" }).minVectorScore, 0.75);
  assert.equal(loadKnowledgeConfig({ AI_KNOWLEDGE_MIN_VECTOR_SCORE: "0.9" }).minVectorScore, 0.9);
  assert.equal(config.generation, loadKnowledgeConfig({ AI_EMBEDDING_DIMENSIONS: "128", AI_KNOWLEDGE_MIN_VECTOR_SCORE: "0.9" }).generation,
    "Đổi ngưỡng truy xuất không làm thay thế hệ vector hoặc phát sinh embedding lại.");
  const prepared = prepareKnowledgeSource(builtinKnowledgeSources()[0], config);
  const chunk = { ...prepared.chunks[0], _id: prepared.chunks[0].id, documentId: prepared.documentId,
    versionId: prepared.versionId, generation: config.generation, scope: "CUSTOMER_PUBLIC" };
  const version = { _id: prepared.versionId, documentId: prepared.documentId, source: prepared.source,
    checksum: prepared.checksum, approvedBy: "kiem-thu" };
  let revoked = false, stale = false, malformed = false, ready = true, score = 0.99, lexical = true;
  const query = (value: unknown) => ({ lean: () => ({ maxTimeMS: async () => value }) }) as never;
  mock.method(Chunks.collection, "listSearchIndexes", () => ({ toArray: async () => [
    { name: config.vectorIndex, queryable: ready, latestDefinition: knowledgeIndexDefinitions(config)[0].definition },
    { name: config.textIndex, queryable: ready },
  ] }) as never);
  mock.method(Chunks, "aggregate", (pipeline: unknown[]) => {
    const serialized = JSON.stringify(pipeline);
    assert(serialized.includes(config.generation)); assert(serialized.includes("CUSTOMER_PUBLIC"));
    return { option: async () => serialized.includes("$vectorSearch") ? [{ _id: chunk._id, score }]
      : lexical ? [{ _id: chunk._id, score: 1 }] : [] } as never;
  });
  mock.method(Chunks, "find", () => query([{ ...chunk, text: malformed ? "Nội dung bị đổi" : chunk.text }]));
  mock.method(Documents, "find", (filter: { status: string; scope: string }) => {
    assert.equal(filter.status, "active"); assert.equal(filter.scope, "CUSTOMER_PUBLIC");
    return query(revoked ? [] : [{ _id: prepared.documentId, publications: { [config.generation]: stale ? "phien-ban-moi" : prepared.versionId } }]);
  });
  mock.method(Versions, "find", () => query([version]));
  let embeddings = 0;
  const provider = { generation: config.generation, embed: async () => { embeddings++; return [Array(128).fill(0.1) as number[]]; } };
  const retrieve = () => retrieveAtlasKnowledge("đặt lại đơn", undefined, config, provider, AbortSignal.timeout(5000));
  try {
    const articles = await retrieve();
    assert.equal(articles.length, 1); assert.equal(articles[0].path, prepared.source.path);
    revoked = true; assert.equal((await retrieve()).length, 0, "Index cũ không vượt qua nguồn đã thu hồi."); revoked = false;
    stale = true; assert.equal((await retrieve()).length, 0, "Chỉ dùng phiên bản được manifest công bố."); stale = false;
    malformed = true; assert.equal((await retrieve()).length, 0, "Không dùng nội dung không khớp nguồn chuẩn."); malformed = false;
    lexical = false; score = 0.85;
    assert.equal((await retrieve()).length, 0, "Loại nguồn dưới ngưỡng dù điểm vượt ngưỡng 0.75 ban đầu.");
    score = config.minVectorScore; assert.equal((await retrieve()).length, 1, "Nguồn tại ngưỡng vẫn được xét cùng manifest.");
    score = 0.1; assert.equal((await retrieve()).length, 0, "Không ép trả lời khi không có nguồn đủ liên quan.");
    ready = false; const before = embeddings;
    await assert.rejects(retrieve); assert.equal(embeddings, before, "Index chưa sẵn sàng không phát sinh lượt embedding truy vấn.");
    console.log("Đạt truy xuất: hybrid có giới hạn, đọc nguồn chuẩn, chặn thu hồi/phiên bản cũ/nội dung sai và phân biệt lỗi index.");
  } finally { mock.restoreAll(); }
}
void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
