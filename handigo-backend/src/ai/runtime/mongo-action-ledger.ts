import type { MongoDBSaverParams } from "@langchain/langgraph-checkpoint-mongodb";
import { AppError } from "../../utils/appError";
import { requireActionMatch, type ActionIdentity, type ActionLedger, type ActionRecord } from "./action-ledger";

export const ACTION_LEDGER_COLLECTION = "ai_agent_actions";
type Document = ActionRecord & { _id: string };

// Dùng cùng native client của graph; không truyền transaction sang Mongoose/service nghiệp vụ.
export class MongoActionLedger implements ActionLedger {
  private readonly collection;
  constructor(private readonly client: MongoDBSaverParams["client"]) {
    this.collection = client.db().collection<Document>(ACTION_LEDGER_COLLECTION);
  }

  async setup() {
    try {
      // Collection/index chỉ được chuẩn bị từ bước quản trị, không từ chat.
      try {
        await this.client.db().createCollection(ACTION_LEDGER_COLLECTION, { validator: { $jsonSchema: {
          bsonType: "object", required: ["_id", "id", "userId", "sessionId", "actionId", "digest", "domain", "tool", "status", "active", "startedAt"],
          properties: { _id: { bsonType: "string" }, id: { bsonType: "string" }, userId: { bsonType: "string" },
            sessionId: { bsonType: "string" }, actionId: { bsonType: "string" }, digest: { bsonType: "string" },
            domain: { enum: ["booking", "payment", "customer-care"] }, tool: { bsonType: "string" },
            status: { enum: ["EXECUTING", "UNKNOWN", "SUCCEEDED", "EXPIRED"] }, active: { bsonType: "bool" },
            startedAt: { bsonType: "string" } },
        } }, validationLevel: "strict", validationAction: "error" });
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === 48)) throw error;
      }
      await this.collection.createIndex({ userId: 1, sessionId: 1 }, {
        unique: true, partialFilterExpression: { active: true }, name: "action_one_unresolved_per_session",
      });
      await this.collection.createIndex({ userId: 1, sessionId: 1, startedAt: -1 }, { name: "action_owner_history" });
    } catch {
      throw new AppError("Chưa thể chuẩn bị sổ hành động của trợ lý.", 503);
    }
  }

  async assertReady() {
    const indexes = await this.collection.listIndexes().toArray();
    if (!indexes.some((index) => index.name === "action_one_unresolved_per_session" && index.unique === true
      && index.key.userId === 1 && index.key.sessionId === 1
      && Object.keys(index.key).length === 2 && index.partialFilterExpression?.active === true)) {
      throw new AppError("Sổ hành động chưa có chỉ mục chống thao tác đồng thời.", 503);
    }
  }

  async find(identity: ActionIdentity) {
    const document = await this.collection.findOne({ _id: identity.id }, { maxTimeMS: 5000 });
    if (!document) return null;
    requireActionMatch(identity, document);
    const { _id, ...record } = document;
    return record;
  }

  async reserve(identity: ActionIdentity) {
    await this.assertReady();
    const record: ActionRecord = { ...identity, status: "EXECUTING", active: true, startedAt: new Date().toISOString() };
    try {
      await this.collection.insertOne({ ...record, _id: identity.id }, { writeConcern: { w: "majority" } });
      return { record, inserted: true };
    } catch (error) {
      // Mất phản hồi insert cũng không cấp quyền thực thi: lần tiếp tục phải đối soát.
      if (!(error instanceof Error && "code" in error && error.code === 11000)) throw error;
      const existing = await this.find(identity);
      if (!existing) throw new AppError("Phiên còn thao tác chưa rõ kết quả. Cần đối soát trước khi ghi tiếp.", 409);
      return { record: existing, inserted: false };
    }
  }

  async settle(identity: ActionIdentity, status: "UNKNOWN" | "SUCCEEDED" | "EXPIRED", result?: unknown) {
    const document = await this.collection.findOneAndUpdate({ _id: identity.id, userId: identity.userId,
      sessionId: identity.sessionId, digest: identity.digest, status: { $in: ["EXECUTING", "UNKNOWN"] } },
    { $set: { status, active: status === "UNKNOWN", ...(result !== undefined ? { result } : {}) } },
    { returnDocument: "after", includeResultMetadata: false, maxTimeMS: 5000, writeConcern: { w: "majority" } });
    if (document) { const { _id, ...record } = document; return record; }
    const existing = await this.find(identity);
    if (existing && (existing.status === "SUCCEEDED" || existing.status === "EXPIRED")) return existing;
    throw new AppError("Chưa thể lưu kết quả hành động. Vui lòng đối soát trước khi tiếp tục.", 409);
  }
}
