import { randomUUID } from "node:crypto";
import { Schema, model } from "mongoose";
import { AppError } from "../../utils/appError";
import { newSession, type AgentSession } from "../agent/agent-state";
import { AgentCaseSubscription, AgentOrderMessage, AgentOrderSubscription } from "../../models/agentOrderProgress.model";
import { mergeAgentOrderMessages } from "../../services/agentOrderProgress.service";

interface SessionDocument {
  updatedAt: Date;
  _id: string;
  userId: string;
  data: AgentSession;
  lockId: string | null;
  lockedUntil: Date;
}
const schema = new Schema<SessionDocument>({
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
  async list(userId: string, page: number, limit: number) {
    const [documents, total] = await Promise.all([
      SessionModel.find({ userId }).sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit)
        .select("data.id data.currentGoal data.state data.conversation data.pendingAction.status data.requiresReconciliation updatedAt")
        .slice("data.conversation", 1).lean(),
      SessionModel.countDocuments({ userId }),
    ]);
    return { items: documents.map((doc) => ({ sessionId: doc.data.id,
      title: (doc.data.conversation[0]?.content || doc.data.currentGoal || "Cuộc trò chuyện mới").slice(0, 120),
      state: doc.data.state, updatedAt: doc.updatedAt,
      needsAttention: Boolean(doc.data.pendingAction || doc.data.requiresReconciliation),
    })), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async get(id: string, userId: string) {
    const doc = await SessionModel.findOne({ _id: id, userId }).lean();
    if (!doc) throw new AppError("Không tìm thấy cuộc trò chuyện.", 404);
    return mergeAgentOrderMessages(doc.data);
  }

  async progress(id: string, userId: string) {
    const doc = await SessionModel.findOne({ _id: id, userId }).select("data.state data.activity data.activeRequest.requestId").lean();
    if (!doc) throw new AppError("Không tìm thấy phiên trợ lý.", 404);
    return { sessionId: id, requestId: doc.data.activeRequest?.requestId ?? null,
      state: doc.data.state, activity: doc.data.activity ?? null };
  }

  async delete(id: string, userId: string) {
    const deleted = await SessionModel.findOneAndDelete({
      _id: id, userId, lockedUntil: { $lte: new Date() },
      "data.pendingAction": null, "data.activeRequest": null,
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

  async reset(id: string, userId: string) {
    const { session, lockId } = await this.acquire(id, userId);
    try {
      if (session.pendingAction || session.activeRequest || session.requiresReconciliation
        || session.actions.some((action) => action.status === "UNKNOWN")) {
        throw new AppError("Vui lòng hoàn tất xác nhận hoặc đối soát thao tác đang chờ trước khi bắt đầu tác vụ mới.", 409);
      }
      const next = newSession(randomUUID(), userId);
      await SessionModel.create({ _id: next.id, userId, data: next });
      return next;
    } finally {
      await this.release(id, lockId);
    }
  }

  async latest(userId: string) {
    const doc = await SessionModel.findOne({ userId }).sort({ updatedAt: -1 }).lean();
    return doc ? mergeAgentOrderMessages(doc.data) : null;
  }

  async acquire(id: string, userId: string) {
    // _id duy nhất ngăn hai request đồng thời tạo hai phiên cùng ID.
    try {
      await SessionModel.updateOne({ _id: id, userId }, { $setOnInsert: {
        data: newSession(id, userId), userId, lockedUntil: new Date(0), lockId: null,
      } }, { upsert: true, runValidators: true });
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === 11000)) throw error;
    }
    const lockId = randomUUID();
    const doc = await SessionModel.findOneAndUpdate({ _id: id, userId,
      lockedUntil: { $lte: new Date() } }, {
      $set: { lockId, lockedUntil: new Date(Date.now() + 120_000) },
    }, { new: true, runValidators: true }).lean();
    if (!doc) throw new AppError("Phiên không khả dụng hoặc đang xử lý. Vui lòng tải lại sau.", 409);
    try {
      return { session: await mergeAgentOrderMessages(doc.data), lockId };
    } catch (error) {
      await this.release(id, lockId);
      throw error;
    }
  }

  async save(session: AgentSession, lockId: string) {
    const result = await SessionModel.updateOne({ _id: session.id, userId: session.userId,
      lockId, lockedUntil: { $gt: new Date() } }, { $set: {
      data: session, lockedUntil: new Date(Date.now() + 120_000),
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
