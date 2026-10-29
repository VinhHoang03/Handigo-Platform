import { Schema, model } from "mongoose";
import { knowledgeSourceSchema, type KnowledgeSource } from "../ai/knowledge/ingestion/chunker";

interface KnowledgeDocument {
  _id: string; sourceKey: string; status: "active" | "revoked"; scope: "CUSTOMER_PUBLIC";
  publications: Map<string, string>; requests: Map<string, string>;
}
export interface KnowledgeVersion {
  _id: string; documentId: string; checksum: string; source: KnowledgeSource; approvedBy: string; approvedAt: Date;
}
export interface KnowledgeChunk {
  _id: string; documentId: string; versionId: string; generation: string; ordinal: number;
  start: number; end: number; text: string; checksum: string; embedding: number[];
  scope: "CUSTOMER_PUBLIC"; topic: string; serviceId: string;
}
export interface KnowledgeJob {
  _id: string; documentId: string; versionId: string; generation: string;
  status: "pending" | "running" | "ready" | "failed" | "superseded";
  attempts: number; leaseId?: string | null; leaseUntil: Date; nextAttemptAt: Date; errorCode?: string | null;
}
const options = { timestamps: true, autoCreate: false, autoIndex: false };
const documentSchema = new Schema<KnowledgeDocument>({ _id: { type: String, required: true },
  sourceKey: { type: String, required: true }, status: { type: String, enum: ["active", "revoked"], default: "active" },
  scope: { type: String, enum: ["CUSTOMER_PUBLIC"], default: "CUSTOMER_PUBLIC" },
  publications: { type: Map, of: String, default: {} }, requests: { type: Map, of: String, default: {} },
}, { ...options, collection: "ai_knowledge_documents" });
documentSchema.index({ sourceKey: 1 }, { unique: true });
const versionSchema = new Schema<KnowledgeVersion>({ _id: { type: String, required: true }, documentId: { type: String, required: true },
  checksum: { type: String, required: true }, source: { type: Schema.Types.Mixed, required: true,
    validate: { validator: (value: unknown) => knowledgeSourceSchema.safeParse(value).success, message: "Nguồn kiến thức không hợp lệ." } },
  approvedBy: { type: String, required: true, maxlength: 100 }, approvedAt: { type: Date, required: true },
}, { ...options, collection: "ai_knowledge_versions" });
versionSchema.index({ documentId: 1, checksum: 1 }, { unique: true });
const chunkSchema = new Schema<KnowledgeChunk>({ _id: { type: String, required: true }, documentId: { type: String, required: true },
  versionId: { type: String, required: true }, generation: { type: String, required: true }, ordinal: { type: Number, required: true, min: 0 },
  start: { type: Number, required: true, min: 0 }, end: { type: Number, required: true, min: 1 },
  text: { type: String, required: true }, checksum: { type: String, required: true },
  embedding: { type: [Number], required: true, validate: { validator: (value: number[]) => value.length > 0 && value.every(Number.isFinite), message: "Vector kiến thức không hợp lệ." } },
  scope: { type: String, enum: ["CUSTOMER_PUBLIC"], required: true }, topic: { type: String, required: true }, serviceId: { type: String, required: true },
}, { ...options, collection: "ai_knowledge_chunks" });
chunkSchema.index({ documentId: 1, versionId: 1, generation: 1, ordinal: 1 }, { unique: true });
const jobSchema = new Schema<KnowledgeJob>({ _id: { type: String, required: true }, documentId: { type: String, required: true },
  versionId: { type: String, required: true }, generation: { type: String, required: true },
  status: { type: String, enum: ["pending", "running", "ready", "failed", "superseded"], default: "pending" },
  attempts: { type: Number, default: 0, min: 0 }, leaseId: { type: String, default: null },
  leaseUntil: { type: Date, default: () => new Date(0) }, nextAttemptAt: { type: Date, default: () => new Date(0) }, errorCode: { type: String, default: null },
}, { ...options, collection: "ai_knowledge_jobs" });
jobSchema.index({ generation: 1, status: 1, nextAttemptAt: 1, leaseUntil: 1 });
export const AiKnowledgeDocument = model<KnowledgeDocument>("AiKnowledgeDocument", documentSchema);
export const AiKnowledgeVersion = model<KnowledgeVersion>("AiKnowledgeVersion", versionSchema);
export const AiKnowledgeChunk = model<KnowledgeChunk>("AiKnowledgeChunk", chunkSchema);
export const AiKnowledgeJob = model<KnowledgeJob>("AiKnowledgeJob", jobSchema);
