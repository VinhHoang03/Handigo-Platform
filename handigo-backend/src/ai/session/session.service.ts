import { randomUUID } from "node:crypto";
import { Schema, model } from "mongoose";
import { AppError } from "../../utils/appError";
import { newSession, type AgentSession } from "../agent/agent-state";
import { AgentCaseSubscription, AgentOrderMessage, AgentOrderSubscription } from "../../models/agentOrderProgress.model";
import { mergeAgentOrderMessages } from "../../services/agentOrderProgress.service";
import { AGENT_SESSION_LEASE_MS } from "../agent/runtime-limits";

export type SessionEngine = "legacy" | "langgraph-readonly" | "langgraph-customer";
interface SessionDocument {
  engine?: SessionEngine;
  deletedAt?: Date | null;
  updatedAt: Date;
  _id: string;
  userId: string;
  data: AgentSession;
  lockId: string | null;
  lockedUntil: Date;
}
const schema = new Schema<SessionDocument>({
  engine: { type: String, enum: ["legacy", "langgraph-readonly", "langgraph-customer"] }, deletedAt: { type: Date },
  _id: { type: String, required: true }, userId: { type: String, required: true },
  data: { type: Schema.Types.Mixed, required: true }, lockId: { type: String, default: null },
  lockedUntil: { type: Date, default: () => new Date(0) },
}, { timestamps: true, collection: "ai_agent_sessions" });
schema.index({ userId: 1, updatedAt: -1 });
schema.index({ userId: 1, updatedAt: -1, _id: -1 });
const SessionModel = model<SessionDocument>("AiAgentSession", schema);

export interface SessionStore {
  acquire(id: string, userId: string): Promise<{ session: AgentSession; lockId: string }>;
  save(session: AgentSession, lockId: string): Promise<void>;
  release(id: string, lockId: string): Promise<void>;
}

export class SessionService implements SessionStore {
  async resolveEngine(id: string, userId: string, create?: SessionEngine | (() => SessionEngine)): Promise<SessionEngine> {
    const existing = await SessionModel.findOne({ _id: id }).select("userId engine deletedAt").lean();
    if (existing) {
      if (existing.userId !== userId || existing.deletedAt) throw new AppError("Không tìm thấy cuộc trò chuyện.", 404);
      return existing.engine ?? "legacy";
    }
    if (create) {
      const engine = typeof create === "function" ? create() : create;
      try {
        await SessionModel.updateOne({ _id: id }, { $setOnInsert: {
          userId, data: newSession(id, userId), engine, lockedUntil: new Date(0), lockId: null,
          createdAt: new Date(), updatedAt: new Date(),
        } }, { upsert: true, runValidators: true, timestamps: false });
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === 11000)) throw error;
      }
    }
    const doc = await SessionModel.findOne({ _id: id, userId, deletedAt: null }).select("engine").lean();
    if (!doc) throw new AppError("Không tìm thấy cuộc trò chuyện.", 404);
    return doc.engine ?? "legacy";
  }

  async saveGraphProjection(session: AgentSession, lockId: string, engine: SessionEngine = "langgraph-readonly") {
    if (engine === "legacy") throw new AppError("Không được lưu projection graph vào phiên engine cũ.", 409);
    const result = await SessionModel.updateOne({ _id: session.id, userId: session.userId,
      engine, deletedAt: null, lockId, lockedUntil: { $gt: new Date() } },
      { $set: { data: session } }, { runValidators: true });
    if (result.matchedCount !== 1) throw new AppError("Phiên đã mất quyền xử lý. Vui lòng tải lại.", 409);
  }

  async archiveGraph(id: string, userId: string, lockId: string, engine: SessionEngine = "langgraph-readonly") {
    if (engine === "legacy") throw new AppError("Không được quản lý phiên cũ bằng đường graph.", 409);
    const result = await SessionModel.updateOne({ _id: id, userId, engine,
      deletedAt: null, lockId, lockedUntil: { $gt: new Date() } },
      { $set: { deletedAt: new Date() } }, { runValidators: true });
    if (result.matchedCount !== 1) throw new AppError("Phiên đã mất quyền xử lý. Vui lòng tải lại.", 409);
  }

  async registerAttachment(id: string, userId: string, url: string) {
    const { session, lockId } = await this.acquire(id, userId);
    try {
      if (session.requiresReconciliation || session.activeRequest || session.pendingAction
        && session.pendingAction.tool !== "create_booking") throw new AppError("Vui lòng xử lý yêu cầu đang chờ trước khi tải ảnh.", 409);
      const urls = session.uploadedAttachments ?? [];
      if (urls.length >= 20) throw new AppError("Cuộc trò chuyện đã đạt giới hạn tải 20 ảnh. Vui lòng bắt đầu tác vụ mới.", 409);
      session.uploadedAttachments = [...urls, url];
      await this.save(session, lockId);
      return { url };
    } finally { await this.release(id, lockId); }
  }

  async list(userId: string, page: number, limit: number) {
    const result = await this.listDirectory(userId, page, limit);
    return { ...result, items: result.items.map(({ engine: _engine, ...item }) => item) };
  }

  async listDirectory(userId: string, page: number, limit: number) {
    const [documents, total] = await Promise.all([
      SessionModel.find({ userId, deletedAt: null }).sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit)
        .select("engine data.id data.currentGoal data.state data.conversation data.pendingAction.status data.requiresReconciliation updatedAt")
        .slice("data.conversation", 1).lean(),
      SessionModel.countDocuments({ userId, deletedAt: null }),
    ]);
    return { items: documents.map((doc) => ({ sessionId: doc.data.id, engine: doc.engine ?? "legacy" as SessionEngine,
      title: (doc.data.conversation[0]?.content || doc.data.currentGoal || "Cuộc trò chuyện mới").slice(0, 120),
      state: doc.data.state, updatedAt: doc.updatedAt,
      needsAttention: Boolean(doc.data.pendingAction || doc.data.requiresReconciliation),
    })), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async get(id: string, userId: string) {
    const doc = await SessionModel.findOne({ _id: id, userId, deletedAt: null }).lean();
    if (!doc) throw new AppError("Không tìm thấy cuộc trò chuyện.", 404);
    return doc.engine && doc.engine !== "legacy" ? doc.data : mergeAgentOrderMessages(doc.data);
  }

  async progress(id: string, userId: string) {
    const doc = await SessionModel.findOne({ _id: id, userId, deletedAt: null }).select("data.state data.activity data.activeRequest.requestId").lean();
    if (!doc) throw new AppError("Không tìm thấy phiên trợ lý.", 404);
    return { sessionId: id, requestId: doc.data.activeRequest?.requestId ?? null,
      state: doc.data.state, activity: doc.data.activity ?? null };
  }

  async delete(id: string, userId: string) {
    const deleted = await SessionModel.findOneAndDelete({
      _id: id, userId, engine: { $in: [null, "legacy"] }, deletedAt: null, lockedUntil: { $lte: new Date() },
      $or: [{ "data.pendingAction": null }, { "data.pendingAction.status": "WAITING_CONFIRMATION" }], "data.activeRequest": null,
      "data.requiresReconciliation": { $ne: true },
      "data.actions.status": { $nin: ["UNKNOWN", "EXECUTING"] },
    }).lean();
    if (deleted) {
      await AgentOrderSubscription.deleteMany({ sessionId: id, userId });
      await AgentCaseSubscription.deleteMany({ sessionId: id, userId });
      await AgentOrderMessage.deleteMany({ sessionId: id, userId });
      return;
    }
    await this.get(id, userId);
    throw new AppError("Vui lòng hoàn tất lượt xử lý, xác nhận hoặc đối soát trước khi xóa cuộc trò chuyện.", 409);
  }

  async reset(id: string, userId: string, engine: SessionEngine = "legacy") {
    await this.get(id, userId);
    const next = newSession(randomUUID(), userId);
    await SessionModel.create({ _id: next.id, userId, data: next, engine });
    return next;
  }

  async latest(userId: string) {
    const doc = await SessionModel.findOne({ userId, deletedAt: null }).sort({ updatedAt: -1, _id: -1 }).lean();
    return doc ? doc.engine && doc.engine !== "legacy" ? doc.data : mergeAgentOrderMessages(doc.data) : null;
  }

  async acquire(id: string, userId: string) {
    return this.acquireEngine(id, userId, "legacy");
  }

  async acquireEngine(id: string, userId: string, engine: SessionEngine): Promise<{ session: AgentSession; lockId: string }> {
    // _id duy nhất ngăn hai request đồng thời tạo hai phiên cùng ID.
    try {
      await SessionModel.updateOne({ _id: id, userId, deletedAt: null,
        engine: engine === "legacy" ? { $in: [null, "legacy"] } : engine }, { $setOnInsert: {
        data: newSession(id, userId), userId, engine, lockedUntil: new Date(0), lockId: null,
      } }, { upsert: true, runValidators: true });
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === 11000)) throw error;
    }
    const lockId = randomUUID();
    const doc = await SessionModel.findOneAndUpdate({ _id: id, userId,
      engine: engine === "legacy" ? { $in: [null, "legacy"] } : engine, deletedAt: null,
      lockedUntil: { $lte: new Date() } }, {
      $set: { lockId, lockedUntil: new Date(Date.now() + AGENT_SESSION_LEASE_MS) },
    }, { returnDocument: "after", runValidators: true }).lean();
    if (!doc) throw new AppError("Phiên không khả dụng hoặc đang xử lý. Vui lòng tải lại sau.", 409);
    try {
      return { session: engine === "legacy" ? await mergeAgentOrderMessages(doc.data) : doc.data, lockId };
    } catch (error) {
      await this.release(id, lockId);
      throw error;
    }
  }

  async save(session: AgentSession, lockId: string) {
    const result = await SessionModel.updateOne({ _id: session.id, userId: session.userId,
      engine: { $in: [null, "legacy"] }, deletedAt: null,
      lockId, lockedUntil: { $gt: new Date() } }, { $set: {
      data: session, lockedUntil: new Date(Date.now() + AGENT_SESSION_LEASE_MS),
    } }, { runValidators: true });
    if (result.matchedCount !== 1) throw new AppError("Phiên đã mất quyền xử lý. Vui lòng tải lại.", 409);
    await mergeAgentOrderMessages(session);
  }

  async release(id: string, lockId: string) {
    // Nhả khóa không làm phiên cũ trở thành phiên mới nhất sau khi đặt lại.
    await SessionModel.updateOne({ _id: id, lockId }, {
      $set: { lockId: null, lockedUntil: new Date(0) },
    }, { runValidators: true, timestamps: false });
  }
}
