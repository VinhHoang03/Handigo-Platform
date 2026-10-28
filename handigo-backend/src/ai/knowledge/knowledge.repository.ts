import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { AiKnowledgeDocument as Documents, AiKnowledgeVersion as Versions, AiKnowledgeChunk as Chunks, AiKnowledgeJob as Jobs,
  type KnowledgeChunk, type KnowledgeJob, type KnowledgeVersion } from "../../models/aiKnowledge.model";
import { AppError } from "../../utils/appError";
import { knowledgeHash, type KnowledgeConfig } from "./knowledge.config";
import type { prepareKnowledgeSource } from "./ingestion/chunker";

const leaseMs = 240000;
const options = { upsert: true, runValidators: true };
export class KnowledgeRepository {
  async setup() {
    for (const model of [Documents, Versions, Chunks, Jobs]) {
      await model.createCollection();
      await model.createIndexes();
    }
  }
  async enqueue(prepared: ReturnType<typeof prepareKnowledgeSource>, config: KnowledgeConfig, approvedBy: string) {
    if (!approvedBy.trim() || approvedBy.length > 100) throw new AppError("Cần ghi nhận người duyệt nguồn kiến thức.", 400);
    const { documentId, versionId, source, checksum } = prepared;
    await Versions.updateOne({ _id: versionId }, { $setOnInsert: { documentId, source, checksum, approvedBy, approvedAt: new Date() } }, options);
    await Documents.updateOne({ _id: documentId }, { $setOnInsert: { sourceKey: source.sourceKey, scope: "CUSTOMER_PUBLIC", status: "active", publications: {} },
      $set: { [`requests.${config.generation}`]: versionId } }, options);
    const id = knowledgeHash(`${versionId}:${config.generation}`);
    await Jobs.updateOne({ _id: id }, { $setOnInsert: { documentId, versionId, generation: config.generation,
      status: "pending", attempts: 0, leaseUntil: new Date(0), nextAttemptAt: new Date(0) } }, options);
    return id;
  }
  async claim(generation: string): Promise<KnowledgeJob | null> {
    return Jobs.findOneAndUpdate({ generation, attempts: { $lt: 5 }, nextAttemptAt: { $lte: new Date() },
      $or: [{ status: "pending" }, { status: "running", leaseUntil: { $lte: new Date() } }] },
    { $set: { status: "running", leaseId: randomUUID(), leaseUntil: new Date(Date.now() + leaseMs), errorCode: null }, $inc: { attempts: 1 } },
    { new: true, runValidators: true }).sort({ nextAttemptAt: 1, _id: 1 }).lean();
  }
  private lease(job: KnowledgeJob) { return { _id: job._id, status: "running" as const, leaseId: job.leaseId, leaseUntil: { $gt: new Date() } }; }
  async renew(job: KnowledgeJob) {
    const result = await Jobs.updateOne(this.lease(job), { $set: { leaseUntil: new Date(Date.now() + leaseMs) } }, { runValidators: true });
    if (result.matchedCount !== 1) throw new AppError("Công việc kiến thức đã mất quyền xử lý.", 409);
  }
  async version(id: string): Promise<KnowledgeVersion | null> { return Versions.findById(id).lean(); }
  async chunks(versionId: string, generation: string): Promise<KnowledgeChunk[]> { return Chunks.find({ versionId, generation }).sort({ ordinal: 1 }).lean(); }
  async putChunk(chunk: KnowledgeChunk) {
    await Chunks.updateOne({ _id: chunk._id }, { $setOnInsert: chunk }, options);
  }
  async publish(job: KnowledgeJob) {
    await mongoose.connection.transaction(async (session) => {
      const locked = await Jobs.findOneAndUpdate(this.lease(job), { $set: { leaseUntil: new Date(Date.now() + leaseMs) } },
        { new: true, runValidators: true, session });
      if (!locked) throw new AppError("Công việc kiến thức đã mất quyền công bố.", 409);
      const result = await Documents.updateOne({ _id: job.documentId, status: "active", [`requests.${job.generation}`]: job.versionId },
        { $set: { [`publications.${job.generation}`]: job.versionId } }, { runValidators: true, session });
      await Jobs.updateOne({ _id: job._id, leaseId: job.leaseId }, { $set: { status: result.matchedCount === 1 ? "ready" : "superseded",
        leaseId: null, leaseUntil: new Date(0), errorCode: null } }, { runValidators: true, session });
    });
  }
  async fail(job: KnowledgeJob) {
    await Jobs.updateOne(this.lease(job), { $set: { status: job.attempts >= 5 ? "failed" : "pending", errorCode: "INDEXING_UNAVAILABLE",
      leaseId: null, leaseUntil: new Date(0), nextAttemptAt: new Date(Date.now() + Math.min(300000, 1000 * 2 ** job.attempts)) } }, { runValidators: true });
  }
  async retry(id: string) {
    await Jobs.updateOne({ _id: id, $or: [{ status: "failed" }, { status: "running", leaseUntil: { $lte: new Date() } }] },
      { $set: { status: "pending", attempts: 0, leaseId: null, leaseUntil: new Date(0), nextAttemptAt: new Date(0) } }, { runValidators: true });
  }
  async revoke(documentId: string) {
    await Documents.updateOne({ _id: documentId }, { $set: { status: "revoked" } }, { runValidators: true });
  }
}
