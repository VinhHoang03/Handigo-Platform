import { AiKnowledgeChunk as Chunks, AiKnowledgeDocument as Documents, AiKnowledgeVersion as Versions } from "../../../models/aiKnowledge.model";
import { knowledgeSourceSchema } from "../ingestion/chunker";
import { knowledgeHash, type KnowledgeConfig } from "../knowledge.config";
import type { EmbeddingProvider } from "../embeddings/embedding-provider";
import { withAgentTimeout } from "../../agent/timeout";
import { AppError } from "../../../utils/appError";
import { z } from "zod";

export async function listKnowledgeIndexes() {
  return z.array(z.object({ name: z.string(), status: z.string().optional(), queryable: z.boolean().optional(),
    latestDefinition: z.record(z.string(), z.unknown()).optional() })).parse(await Chunks.collection.listSearchIndexes().toArray());
}

export async function requireKnowledgeIndexes(config: KnowledgeConfig) {
  const indexes = await listKnowledgeIndexes();
  const vector = indexes.find((index) => index.name === config.vectorIndex);
  const text = indexes.find((index) => index.name === config.textIndex);
  const fields = vector?.latestDefinition?.fields as Array<{ type?: string; path?: string; numDimensions?: number; similarity?: string }> | undefined;
  if (![vector, text].every((index) => index?.queryable === true) || !fields?.some((field) => field.type === "vector"
    && field.path === "embedding" && field.numDimensions === config.dimensions && field.similarity === "cosine")) {
    throw new AppError("Index kiến thức chưa sẵn sàng hoặc không khớp số chiều embedding.", 503);
  }
}

export function knowledgeIndexDefinitions(config: KnowledgeConfig) {
  return [
    { name: config.vectorIndex, type: "vectorSearch" as const, definition: { fields: [
      { type: "vector", path: "embedding", numDimensions: config.dimensions, similarity: "cosine" },
      ...["documentId", "versionId", "generation", "scope", "topic", "serviceId"].map((path) => ({ type: "filter", path })),
    ] } },
    { name: config.textIndex, type: "search" as const, definition: { mappings: { dynamic: false, fields: {
      text: { type: "string", analyzer: "lucene.standard" },
      ...Object.fromEntries(["documentId", "versionId", "generation", "scope", "topic", "serviceId"].map((path) => [path, { type: "token" }])),
    } } } },
  ];
}

export async function knowledgeIndexesContain(config: KnowledgeConfig, versionId: string, ids: string[], vector: number[]) {
  const filter = { versionId, generation: config.generation, scope: "CUSTOMER_PUBLIC" };
  const [vectors, texts] = await Promise.all([
    Chunks.aggregate<{ _id: string }>([{ $vectorSearch: { index: config.vectorIndex, path: "embedding", queryVector: vector,
      exact: true, limit: ids.length + 1, filter } }, { $project: { _id: 1 } }]).option({ maxTimeMS: config.timeoutMs }),
    Chunks.aggregate<{ _id: string }>([{ $search: { index: config.textIndex, compound: {
      filter: Object.entries(filter).map(([path, value]) => ({ equals: { path, value } })),
    } } }, { $limit: ids.length + 1 }, { $project: { _id: 1 } }]).option({ maxTimeMS: config.timeoutMs }),
  ]);
  return [vectors, texts].every((rows) => rows.length === ids.length && ids.every((id) => rows.some((row) => row._id === id)));
}

export async function retrieveAtlasKnowledge(query: string, topic: string | undefined, config: KnowledgeConfig, provider: EmbeddingProvider, signal: AbortSignal) {
  if (provider.generation !== config.generation) throw new Error("Thế hệ embedding truy vấn không khớp.");
  await requireKnowledgeIndexes(config);
  const [vector] = await provider.embed([query], "query", signal);
  const filter = { generation: config.generation, scope: "CUSTOMER_PUBLIC", ...(topic ? { topic } : {}) };
  const [semantic, lexical] = await withAgentTimeout(Promise.all([
    Chunks.aggregate<{ _id: string; score: number }>([{ $vectorSearch: { index: config.vectorIndex, path: "embedding", queryVector: vector,
      numCandidates: 300, limit: 30, filter } }, { $project: { _id: 1, score: { $meta: "vectorSearchScore" } } }])
      .option({ maxTimeMS: config.timeoutMs }),
    Chunks.aggregate<{ _id: string; score: number }>([{ $search: { index: config.textIndex, compound: {
      must: [{ text: { query, path: "text", matchCriteria: "all" } }],
      filter: Object.entries(filter).map(([path, value]) => ({ equals: { path, value } })),
    } } }, { $limit: 30 }, { $project: { _id: 1, score: { $meta: "searchScore" } } }]).option({ maxTimeMS: config.timeoutMs }),
  ]), signal, config.timeoutMs);
  const scores = new Map<string, number>();
  [semantic.filter((row) => row.score >= config.minVectorScore), lexical].forEach((rows) => rows.forEach((row, rank) => {
    scores.set(row._id, (scores.get(row._id) ?? 0) + 1 / (60 + rank + 1));
  }));
  const ranked = [...scores].sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, 40);
  if (!ranked.length) return [];
  // Đọc lại dữ liệu chuẩn: không tin nội dung/phiên bản còn sót trong search index.
  const chunks = await Chunks.find({ _id: { $in: ranked }, generation: config.generation, scope: "CUSTOMER_PUBLIC" }).lean().maxTimeMS(config.timeoutMs);
  const documents = await Documents.find({ _id: { $in: [...new Set(chunks.map((chunk) => chunk.documentId))] },
    status: "active", scope: "CUSTOMER_PUBLIC" }).lean().maxTimeMS(config.timeoutMs);
  const versions = await Versions.find({ _id: { $in: [...new Set(chunks.map((chunk) => chunk.versionId))] } }).lean().maxTimeMS(config.timeoutMs);
  const articles: Array<{ topic: string; title: string; content: string; source: string; path: string }> = [];
  const used = new Set<string>();
  let contextSize = 0;
  for (const id of ranked) {
    signal.throwIfAborted();
    const chunk = chunks.find((item) => item._id === id);
    const document = chunk && documents.find((item) => item._id === chunk.documentId);
    const publication = document?.publications as Record<string, string> | undefined;
    if (!chunk || publication?.[config.generation] !== chunk.versionId || used.has(chunk.documentId)) continue;
    const version = versions.find((item) => item._id === chunk.versionId && item.documentId === chunk.documentId);
    const parsed = knowledgeSourceSchema.safeParse(version?.source);
    if (!version || !version.approvedBy || !parsed.success || knowledgeHash(JSON.stringify(parsed.data)) !== version.checksum
      || knowledgeHash(`${chunk.documentId}:${version.checksum}`) !== version._id
      || knowledgeHash(parsed.data.sourceKey) !== chunk.documentId || topic && parsed.data.topic !== topic
      || Date.parse(parsed.data.effectiveFrom) > Date.now()
      || parsed.data.effectiveUntil && Date.parse(parsed.data.effectiveUntil) <= Date.now()
      || chunk.text !== parsed.data.content.slice(chunk.start, chunk.end) || chunk.checksum !== knowledgeHash(chunk.text)) continue;
    const content = `${parsed.data.title}\n${chunk.text}`;
    if (contextSize + content.length > 10000) continue;
    articles.push({ topic: parsed.data.topic, title: parsed.data.title, content,
      source: `${parsed.data.source} (phiên bản ${version._id.slice(0, 12)})`, path: parsed.data.path });
    used.add(chunk.documentId); contextSize += content.length;
    if (articles.length === 3) break;
  }
  return articles;
}
