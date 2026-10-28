import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { MongoDBSaver, type MongoDBSaverParams } from "@langchain/langgraph-checkpoint-mongodb";
import { z } from "zod";
import type { RequestUser } from "../../middlewares/authContext";
import { AppError } from "../../utils/appError";
import type { GraphThreadAccess } from "./agent-runtime";
import { READ_ONLY_GRAPH_VERSION } from "./graph-state";
import { GRAPH_CHECKPOINT_COLLECTIONS, createGraphMongoClient } from "./checkpoint";
import { AGENT_SESSION_LEASE_MS } from "../agent/runtime-limits";
import { newSession } from "../agent/agent-state";
import type { ReadOnlyGraphData } from "./graph-state";
import { projectReadOnlySession } from "./session-adapter";

type Client = MongoDBSaverParams["client"];
type ClientSession = ReturnType<Client["startSession"]>;
type Config = Parameters<MongoDBSaver["getTuple"]>[0];
export const GRAPH_THREAD_COLLECTION = "ai_graph_threads";
export const CUSTOMER_GRAPH_VERSION = "customer-workflow-v1";
export const CUSTOMER_GRAPH_PROFILE = Object.freeze({ collection: "ai_customer_graph_threads", engine: "langgraph-customer" as const,
  version: CUSTOMER_GRAPH_VERSION });
const READONLY_PROFILE = Object.freeze({ collection: GRAPH_THREAD_COLLECTION, engine: "langgraph-readonly" as const,
  version: READ_ONLY_GRAPH_VERSION });
export type GraphStorageProfile = typeof READONLY_PROFILE | typeof CUSTOMER_GRAPH_PROFILE;
const identity = z.string().min(1).max(100);

export interface GraphThreadDocument {
  _id: string;
  userId: string;
  threadId: string;
  engine: GraphStorageProfile["engine"];
  version: GraphStorageProfile["version"];
  fence: number;
  lockId: string | null;
  lockedUntil: Date;
  writeVersion: number;
  createdAt: Date;
  updatedAt: Date;
}
interface Lease {
  sessionId: string; userId: string; threadId: string; lockId: string; fence: number; active: boolean;
}
const lostLease = () => new AppError("Phiên đã mất quyền xử lý. Vui lòng tải lại hoặc tiếp tục yêu cầu.", 409);

// Native driver dùng chung client với checkpointer để metadata và checkpoint vào cùng transaction.
// Không truyền session của driver này sang Mongoose hoặc service nghiệp vụ.
export class MongoGraphThreadAccess implements GraphThreadAccess {
  private readonly scope = new AsyncLocalStorage<Lease>();
  private readonly threads;

  constructor(private readonly client: Client, private readonly leaseMs = AGENT_SESSION_LEASE_MS,
    private readonly profile: GraphStorageProfile = READONLY_PROFILE) {
    z.number().int().min(100).max(AGENT_SESSION_LEASE_MS).parse(leaseMs);
    this.threads = client.db().collection<GraphThreadDocument>(profile.collection);
  }

  async setup() {
    try {
      await this.client.db().createCollection(this.profile.collection, { validator: { $jsonSchema: {
        bsonType: "object", required: ["_id", "userId", "threadId", "engine", "version", "fence", "lockId",
          "lockedUntil", "writeVersion", "createdAt", "updatedAt"], properties: {
          _id: { bsonType: "string", minLength: 1, maxLength: 100 }, userId: { bsonType: "string", minLength: 1, maxLength: 100 },
          threadId: { bsonType: "string" }, engine: { enum: [this.profile.engine] }, version: { enum: [this.profile.version] },
          fence: { bsonType: ["int", "long", "double"], minimum: 0 }, lockId: { bsonType: ["string", "null"] },
          lockedUntil: { bsonType: "date" }, writeVersion: { bsonType: ["int", "long", "double"], minimum: 0 },
          createdAt: { bsonType: "date" }, updatedAt: { bsonType: "date" },
        },
      } }, validationLevel: "strict", validationAction: "error" });
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === 48)) throw error;
    }
    await this.threads.createIndex({ threadId: 1 }, { unique: true, name: "graph_thread_unique" });
    await this.threads.createIndex({ userId: 1, updatedAt: -1, _id: -1 }, { name: "graph_owner_updated" });
  }

  async exclusive<T>(user: RequestUser, sessionId: string, run: (threadId: string) => Promise<T>): Promise<T> {
    if (user.role !== "CUSTOMER") throw new AppError("Trợ lý hệ thống chỉ dành cho khách hàng.", 403);
    identity.parse(user.id); identity.parse(sessionId);
    const now = new Date();
    try {
      await this.threads.insertOne({ _id: sessionId, userId: user.id, threadId: randomUUID(),
        engine: this.profile.engine, version: this.profile.version,
        fence: 0, lockId: null, lockedUntil: new Date(0), writeVersion: 0, createdAt: now, updatedAt: now });
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === 11000)) throw error;
    }
    const lockId = randomUUID();
    const doc = await this.threads.findOneAndUpdate({ _id: sessionId, userId: user.id,
      engine: this.profile.engine, version: this.profile.version,
      $expr: { $lte: ["$lockedUntil", "$$NOW"] } }, [{ $set: {
      lockId, fence: { $add: ["$fence", 1] }, lockedUntil: this.expiry(), updatedAt: "$$NOW",
    } }], { returnDocument: "after", includeResultMetadata: false });
    if (!doc) throw new AppError("Phiên không khả dụng hoặc đang xử lý. Vui lòng tải lại sau.", 409);
    const lease: Lease = { sessionId, userId: user.id, threadId: doc.threadId, lockId, fence: doc.fence, active: true };
    return this.scope.run(lease, async () => {
      try {
        const result = await run(doc.threadId);
        await this.assertLease(doc.threadId);
        return result;
      } finally {
        lease.active = false;
        // Tiến trình cũ không thể nhả khóa của chủ mới sau takeover.
        await this.threads.updateOne({ _id: sessionId, userId: user.id, lockId, fence: lease.fence },
          { $set: { lockId: null, lockedUntil: new Date(0) } });
      }
    });
  }

  async lookup(sessionId: string, userId: string) {
    const doc = await this.threads.findOne({ _id: sessionId });
    if (doc && (doc.userId !== userId || doc.engine !== this.profile.engine || doc.version !== this.profile.version)) {
      throw new AppError("Không tìm thấy phiên graph tương thích.", 404);
    }
    return doc;
  }

  private expiry() { return { $dateAdd: { startDate: "$$NOW", unit: "millisecond", amount: this.leaseMs } }; }

  private lease(threadId: unknown) {
    const lease = this.scope.getStore();
    if (!lease?.active || typeof threadId !== "string" || lease.threadId !== threadId) throw lostLease();
    return lease;
  }

  private filter(lease: Lease) {
    return { _id: lease.sessionId, userId: lease.userId, threadId: lease.threadId,
      engine: this.profile.engine, version: this.profile.version,
      lockId: lease.lockId, fence: lease.fence, $expr: { $gt: ["$lockedUntil", "$$NOW"] } };
  }

  async assertLease(threadId: unknown) {
    const lease = this.lease(threadId);
    if (!await this.threads.findOne(this.filter(lease), { projection: { _id: 1 } })) throw lostLease();
  }

  async write<T>(threadId: unknown, action: (session: ClientSession) => Promise<T>): Promise<T> {
    const lease = this.lease(threadId);
    const session = this.client.startSession();
    try {
      return await session.withTransaction(async () => {
        if (!lease.active) throw lostLease();
        // Ghi lên metadata trong cùng transaction tạo xung đột với takeover.
        const result = await this.threads.updateOne(this.filter(lease), [{ $set: {
          lockedUntil: this.expiry(), updatedAt: "$$NOW", writeVersion: { $add: ["$writeVersion", 1] },
        } }], { session });
        if (result.matchedCount !== 1) throw lostLease();
        return action(session);
      }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary", maxCommitTimeMS: 10000 });
    } finally { await session.endSession(); }
  }
}

/** Bọc đúng hai đường ghi của MongoDBSaver đã ghim: updateOne và bulkWrite. */
export class FencedMongoDBSaver extends MongoDBSaver {
  private readonly transaction = new AsyncLocalStorage<ClientSession>();

  constructor(client: Client, private readonly access: MongoGraphThreadAccess) {
    super({ client, checkpointCollectionName: GRAPH_CHECKPOINT_COLLECTIONS.checkpoints,
      checkpointWritesCollectionName: GRAPH_CHECKPOINT_COLLECTIONS.writes, enableTimestamps: true });
    const database = this.db;
    this.db = new Proxy(database, { get: (target, key) => {
      if (key === "collection") return (name: string) => {
        const collection = target.collection(name);
        return new Proxy(collection, { get: (original, method) => {
          if (method === "updateOne" || method === "bulkWrite") return (...args: unknown[]) => {
            const session = this.transaction.getStore();
            if (!session) throw lostLease();
            const optionIndex = method === "updateOne" ? 2 : 1;
            args[optionIndex] = { ...(args[optionIndex] as object | undefined), session };
            const invoke = Reflect.get(original, method) as (...values: unknown[]) => unknown;
            return invoke.apply(original, args);
          };
          if (["insertOne", "insertMany", "replaceOne", "updateMany", "findOneAndUpdate", "findOneAndReplace",
            "deleteOne", "deleteMany", "findOneAndDelete"].includes(String(method))) {
            return () => { throw new AppError("Đường ghi checkpoint chưa được kiểm chứng cho phiên bản này.", 503); };
          }
          const value: unknown = Reflect.get(original, method);
          return typeof value === "function" ? value.bind(original) : value;
        } });
      };
      const value: unknown = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    } });
  }

  override async getTuple(config: Config) {
    await this.access.assertLease(config.configurable?.thread_id);
    return super.getTuple(config);
  }

  override async *list(config: Config, options?: Parameters<MongoDBSaver["list"]>[1]) {
    await this.access.assertLease(config.configurable?.thread_id);
    for await (const tuple of super.list(config, options)) {
      await this.access.assertLease(config.configurable?.thread_id);
      yield tuple;
    }
  }

  override put(...args: Parameters<MongoDBSaver["put"]>) {
    return this.access.write(args[0].configurable?.thread_id,
      (session) => this.transaction.run(session, () => super.put(...args)));
  }

  override putWrites(...args: Parameters<MongoDBSaver["putWrites"]>) {
    return this.access.write(args[0].configurable?.thread_id,
      (session) => this.transaction.run(session, () => super.putWrites(...args)));
  }

  override async deleteThread(_threadId: string): Promise<void> {
    throw new AppError("Chưa hỗ trợ xóa checkpoint trong giai đoạn thử nghiệm.", 403);
  }
}

export function createPersistentGraphConnection(uri: string, leaseMs = AGENT_SESSION_LEASE_MS) {
  const client = createGraphMongoClient(uri);
  const access = new MongoGraphThreadAccess(client, leaseMs);
  const saver = new FencedMongoDBSaver(client, access);
  // Chỉ dùng nội bộ sau lookup owner; không xuất reader không khóa cho caller.
  const reader = new MongoDBSaver({ client, checkpointCollectionName: GRAPH_CHECKPOINT_COLLECTIONS.checkpoints,
    checkpointWritesCollectionName: GRAPH_CHECKPOINT_COLLECTIONS.writes });
  return {
    access, saver,
    async open() {
      try {
        await client.connect();
        const indexes = [
          { collection: GRAPH_THREAD_COLLECTION, name: "graph_thread_unique", key: { threadId: 1 }, unique: true },
          { collection: GRAPH_CHECKPOINT_COLLECTIONS.checkpoints, name: "thread_ns_checkpoint_idx",
            key: { thread_id: 1, checkpoint_ns: 1, checkpoint_id: -1 }, unique: false },
          { collection: GRAPH_CHECKPOINT_COLLECTIONS.writes, name: "thread_ns_checkpoint_task_idx",
            key: { thread_id: 1, checkpoint_ns: 1, checkpoint_id: 1, task_id: 1, idx: 1 }, unique: false },
        ];
        for (const required of indexes) {
          const found = (await client.db().collection(required.collection).listIndexes().toArray()).find((index) => index.name === required.name);
          if (!found || JSON.stringify(found.key) !== JSON.stringify(required.key) || Boolean(found.unique) !== required.unique) {
            throw new Error("Kho graph chưa có index tương thích.");
          }
        }
      } catch {
        await client.close().catch(() => undefined);
        throw new AppError("Kho graph chưa sẵn sàng. Cần chuẩn bị collection và index trước khi mở phiên thử nghiệm.", 503);
      }
    },
    async get(sessionId: string, userId: string) {
      const doc = await access.lookup(sessionId, userId);
      if (!doc) return newSession(sessionId, userId);
      const tuple = await reader.getTuple({ configurable: { thread_id: doc.threadId } });
      const values = tuple?.checkpoint.channel_values;
      const start = values?.__start__ as { data?: ReadOnlyGraphData } | undefined;
      const data = (values?.data ?? start?.data) as ReadOnlyGraphData | undefined;
      if (!data) {
        if (doc.writeVersion > 0) throw new AppError("Phiên cần khôi phục checkpoint trước khi tiếp tục quản lý cuộc trò chuyện.", 409);
        return newSession(sessionId, userId);
      }
      if (data.userId !== userId || data.sessionId !== sessionId || data.version !== READ_ONLY_GRAPH_VERSION) {
        throw new AppError("Checkpoint không khớp phiên hoặc phiên bản runtime.", 409);
      }
      return projectReadOnlySession(data);
    },
    async setup() {
      try {
        await client.connect();
        await access.setup();
        if ((await saver.setup()).length) throw new Error("Không tạo được index checkpoint.");
      } catch {
        await client.close().catch(() => undefined);
        throw new AppError("Chưa thể chuẩn bị kho phiên graph. Vui lòng kiểm tra kết nối và quyền database.", 503);
      }
    },
    close: () => client.close(),
  };
}
