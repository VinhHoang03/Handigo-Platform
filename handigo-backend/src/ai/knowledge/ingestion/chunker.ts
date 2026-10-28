import { z } from "zod";
import { knowledgeTopics } from "../customer-knowledge";
import { knowledgeHash, type KnowledgeConfig } from "../knowledge.config";

export const knowledgeSourceSchema = z.object({
  sourceKey: z.string().regex(/^[a-z0-9][a-z0-9/_-]{1,180}$/),
  title: z.string().trim().min(1).max(200), topic: z.enum(knowledgeTopics),
  source: z.string().trim().min(1).max(300), path: z.string().regex(/^\/(?!\/)[a-zA-Z0-9/_-]*$/),
  content: z.string().trim().min(1).max(200000), serviceId: z.string().regex(/^[a-f\d]{24}$/).optional(),
  effectiveFrom: z.string().datetime().default("1970-01-01T00:00:00.000Z"), effectiveUntil: z.string().datetime().optional(),
}).strict().refine((value) => !value.effectiveUntil || Date.parse(value.effectiveUntil) > Date.parse(value.effectiveFrom),
  "Thời gian hiệu lực của tài liệu không hợp lệ.");
export type KnowledgeSource = z.infer<typeof knowledgeSourceSchema>;

export function prepareKnowledgeSource(input: unknown, config: KnowledgeConfig) {
  const parsed = knowledgeSourceSchema.parse(input);
  const source = { ...parsed, content: parsed.content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").normalize("NFC").trim() };
  const documentId = knowledgeHash(source.sourceKey);
  const checksum = knowledgeHash(JSON.stringify(source));
  const versionId = knowledgeHash(`${documentId}:${checksum}`);
  const chunks: Array<{ id: string; ordinal: number; start: number; end: number; text: string; checksum: string }> = [];
  let start = 0;
  while (start < source.content.length) {
    let end = Math.min(start + config.chunkSize, source.content.length);
    if (end < source.content.length) {
      const fragment = source.content.slice(start, end);
      const boundaries = [...fragment.matchAll(/\n\n|[.!?](?=\s)/g)];
      const boundary = boundaries.filter((item) => item.index! >= config.chunkSize / 2).pop();
      if (boundary) end = start + boundary.index! + boundary[0].length;
      // Không cắt đôi một ký tự Unicode ngoài BMP.
      if (/[\uD800-\uDBFF]/.test(source.content[end - 1])) end--;
    }
    const text = source.content.slice(start, end);
    chunks.push({ id: knowledgeHash(`${versionId}:${config.generation}:${chunks.length}`), ordinal: chunks.length,
      start, end, text, checksum: knowledgeHash(text) });
    if (end === source.content.length) break;
    const next = Math.max(start + 1, end - config.chunkOverlap);
    start = /[\uDC00-\uDFFF]/.test(source.content[next]) ? next + 1 : next;
  }
  return { documentId, versionId, checksum, source, chunks };
}
