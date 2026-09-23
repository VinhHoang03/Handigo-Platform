import { randomUUID } from "node:crypto";
import { Schema, model } from "mongoose";
import { AppError } from "../../utils/appError";
import { newSession, type AgentSession } from "../agent/agent-state";

interface SessionDocument {
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
const SessionModel = model<SessionDocument>("AiAgentSession", schema);

export interface SessionStore {
  acquire(id: string, userId: string): Promise<{ session: AgentSession; lockId: string }>;
  save(session: AgentSession, lockId: string): Promise<void>;
  release(id: string, lockId: string): Promise<void>;
}

export class SessionService implements SessionStore {
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
    return doc?.data ?? null;
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
    return { session: doc.data, lockId };
  }

  async save(session: AgentSession, lockId: string) {
    const result = await SessionModel.updateOne({ _id: session.id, userId: session.userId,
      lockId, lockedUntil: { $gt: new Date() } }, { $set: {
      data: session, lockedUntil: new Date(Date.now() + 120_000),
    } }, { runValidators: true });
    if (result.matchedCount !== 1) throw new AppError("Phiên đã mất quyền xử lý. Vui lòng tải lại.", 409);
  }

  async release(id: string, lockId: string) {
    // Nhả khóa không làm phiên cũ trở thành phiên mới nhất sau khi đặt lại.
    await SessionModel.updateOne({ _id: id, lockId }, {
      $set: { lockId: null, lockedUntil: new Date(0) },
    }, { runValidators: true, timestamps: false });
  }
}
