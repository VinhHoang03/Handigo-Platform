import assert from "node:assert/strict";
import { loadKnowledgeConfig } from "../ai/knowledge/knowledge.config";
import { createEmbeddingProvider } from "../ai/knowledge/embeddings/embedding-provider";
import { prepareKnowledgeSource } from "../ai/knowledge/ingestion/chunker";
import { builtinKnowledgeSources } from "../ai/knowledge/ingestion/builtin-sources";
import { processKnowledgeJob } from "../ai/knowledge/ingestion/indexing-worker";
import type { KnowledgeRepository } from "../ai/knowledge/knowledge.repository";
import type { KnowledgeChunk, KnowledgeJob } from "../models/aiKnowledge.model";

async function run() {
  const config = loadKnowledgeConfig({ AI_EMBEDDING_DIMENSIONS: "128" });
  const signal = AbortSignal.timeout(30000);
  const vector = Array.from({ length: 128 }, (_, index) => index === 0 ? 2 : 0);
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const request: typeof fetch = async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(String(options?.body)) });
    return new Response(JSON.stringify({ embedding: { values: vector } }), { status: 200 });
  };
  const provider = createEmbeddingProvider(config, { GEMINI_API_KEY: "khoa-gia-lap" }, request);
  const documents = await provider.embed(["Chính sách hủy đơn", "Hướng dẫn địa chỉ"], "document", signal);
  assert.equal(documents.length, 2); assert.equal(calls.length, 2);
  assert.equal(documents[0][0], 1);
  assert(String(JSON.stringify(calls[0].body)).includes("title: none | text:"));
  await provider.embed(["Địa chỉ dùng một lần"], "query", signal);
  assert(String(JSON.stringify(calls[2].body)).includes("task: search result | query:"));
  assert.equal((calls[0].body.embedContentConfig as { outputDimensionality: number }).outputDimensionality, 128);
  const openai = loadKnowledgeConfig({ AI_EMBEDDING_PROVIDER: "openai", AI_EMBEDDING_DIMENSIONS: "128" });
  assert.notEqual(config.generation, openai.generation, "Cùng số chiều nhưng khác provider phải tạo thế hệ mới.");
  assert.notEqual(config.vectorIndex, openai.vectorIndex);
  assert.throws(() => loadKnowledgeConfig({ AI_EMBEDDING_PROVIDER: "openai", AI_EMBEDDING_MODEL: "gemini-embedding-2" }));
  const switched = createEmbeddingProvider(openai, { OPENAI_API_KEY: "khoa-gia-lap" }, async () => new Response(JSON.stringify({
    data: [{ index: 1, embedding: vector }, { index: 0, embedding: vector.map((value) => -value) }],
  })));
  const reordered = await switched.embed(["Nguồn thứ nhất", "Nguồn thứ hai"], "document", signal);
  assert.equal(reordered[0][0], -1); assert.equal(reordered[1][0], 1);
  const bad = createEmbeddingProvider(config, { GEMINI_API_KEY: "khoa-gia-lap" }, async () => new Response(JSON.stringify({ embedding: { values: [1] } })));
  await assert.rejects(() => bad.embed(["Nguồn thử"], "document", signal));
  const failed = createEmbeddingProvider(config, { GEMINI_API_KEY: "khoa-gia-lap" }, async () => new Response("noi-dung-bi-mat-gia-lap", { status: 429 }));
  await assert.rejects(() => failed.embed(["Nguồn thử"], "query", signal), (error: unknown) => error instanceof Error && !error.message.includes("bi-mat"));
  const aborted = AbortSignal.abort();
  const before = calls.length;
  await assert.rejects(() => provider.embed(["Nguồn thử"], "query", aborted));
  assert.equal(calls.length, before);

  const builtins = builtinKnowledgeSources();
  assert.equal(builtins.length, 15);
  assert.equal(new Set(builtins.map((source) => source.sourceKey)).size, builtins.length);
  for (const source of builtins) {
    const prepared = prepareKnowledgeSource(source, config);
    assert(prepared.chunks.length);
    let covered = 0;
    for (const chunk of prepared.chunks) {
      assert(chunk.start <= covered); assert(chunk.end > covered);
      assert.equal(chunk.text, prepared.source.content.slice(chunk.start, chunk.end));
      assert(chunk.text.length <= config.chunkSize); covered = chunk.end;
    }
    assert.equal(covered, prepared.source.content.length);
  }
  const source = { ...builtins[0], content: ("Điều kiện đã duyệt.\n\n".repeat(130)) + "Không tự hứa hoàn tiền." };
  const prepared = prepareKnowledgeSource(source, config);
  const overlapping = prepareKnowledgeSource(source, loadKnowledgeConfig({ AI_KNOWLEDGE_CHUNK_SIZE: "500", AI_KNOWLEDGE_CHUNK_OVERLAP: "300" }));
  assert(overlapping.chunks.every((chunk, index) => !index || chunk.start > overlapping.chunks[index - 1].start));
  assert.equal(prepared.versionId, prepareKnowledgeSource(source, config).versionId);
  assert.notEqual(prepared.versionId, prepareKnowledgeSource({ ...source, content: `${source.content} Đã sửa.` }, config).versionId);
  assert.notEqual(prepared.chunks[0].id, prepareKnowledgeSource(source, openai).chunks[0].id);
  const job: KnowledgeJob = { _id: "cong-viec", documentId: prepared.documentId, versionId: prepared.versionId, generation: config.generation,
    status: "running", attempts: 1, leaseId: "khoa", leaseUntil: new Date(Date.now() + 240000), nextAttemptAt: new Date(0) };
  const stored = new Map<string, KnowledgeChunk>();
  let embeds = 0, publications = 0, failures = 0, indexReady = false, loseLease = false;
  const repository: Pick<KnowledgeRepository, "claim" | "renew" | "version" | "chunks" | "putChunk" | "publish" | "fail"> = {
    claim: async () => job,
    renew: async () => { if (loseLease) throw new Error("Mất lease giả lập"); },
    version: async () => ({ _id: prepared.versionId, documentId: prepared.documentId, source: prepared.source,
      checksum: prepared.checksum, approvedBy: "nguoi-duyet-gia-lap", approvedAt: new Date() }),
    chunks: async () => [...stored.values()],
    putChunk: async (chunk) => { if (!stored.has(chunk._id)) stored.set(chunk._id, chunk); },
    publish: async () => { publications++; }, fail: async () => { failures++; },
  };
  const fakeProvider = { generation: config.generation, embed: async (texts: string[]) => { embeds += texts.length; return texts.map(() => vector); } };
  const indexContains = async () => indexReady;
  assert.equal(await processKnowledgeJob(config, fakeProvider, repository, indexContains, signal), "retry");
  assert.equal(publications, 0, "Chưa đồng bộ index thì không công bố dù đã có vector.");
  assert.equal(stored.size, prepared.chunks.length);
  const firstEmbeds = embeds;
  indexReady = true;
  assert.equal(await processKnowledgeJob(config, fakeProvider, repository, indexContains, signal), "processed");
  assert.equal(embeds, firstEmbeds, "Worker tiếp tục từ chunk đã lưu, không embedding lại toàn bộ.");
  assert.equal(publications, 1);
  loseLease = true;
  assert.equal(await processKnowledgeJob(config, fakeProvider, repository, indexContains, signal), "retry");
  assert.equal(publications, 1, "Worker mất lease không công bố."); assert.equal(failures, 2);
  await assert.rejects(() => processKnowledgeJob(openai, fakeProvider, repository, indexContains, signal));
  console.log("Đạt pipeline kiến thức: Gemini/OpenAI giả lập, số chiều, lỗi/hủy, chia đoạn, thế hệ, worker tiếp tục và chờ index/lease.");
}
void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
