import assert from "node:assert/strict";
import { mock } from "node:test";
import { emptyCheckpoint } from "@langchain/langgraph";
import type { MongoDBSaverParams } from "@langchain/langgraph-checkpoint-mongodb";
import { createGraphMongoClient, GRAPH_CHECKPOINT_COLLECTIONS } from "../ai/runtime/checkpoint";
import { FencedMongoDBSaver, MongoGraphThreadAccess, GRAPH_THREAD_COLLECTION, type GraphThreadDocument } from "../ai/runtime/mongo-graph-access";
import { AppError } from "../utils/appError";

// Giả lập transport để kiểm tra predicate và cùng session; không thay bằng chứng transaction Atlas.
async function run() {
  type Client = MongoDBSaverParams["client"];
  let clock = Date.now();
  const rows = new Map<string, GraphThreadDocument>();
  const events: Array<{ collection: string; session: unknown; method: string }> = [];
  let failCheckpoint = false;
  const collection = (name: string) => {
    const matches = (row: GraphThreadDocument, query: Record<string, unknown>) => Object.entries(query).every(([key, value]) => {
      if (key === "$expr") {
        const expr = value as { $gt?: string[]; $lte?: string[] };
        return expr.$gt ? row.lockedUntil.getTime() > clock : row.lockedUntil.getTime() <= clock;
      }
      return row[key as keyof GraphThreadDocument] === value;
    });
    const update = (row: GraphThreadDocument, operation: unknown) => {
      if (Array.isArray(operation)) {
        const set = operation[0].$set;
        if (typeof set.lockId === "string") row.lockId = set.lockId;
        if (set.fence) row.fence++;
        if (set.writeVersion) row.writeVersion++;
        row.lockedUntil = new Date(clock + set.lockedUntil.$dateAdd.amount);
        row.updatedAt = new Date(clock);
      } else Object.assign(row, (operation as { $set: object }).$set);
    };
    return {
      async insertOne(row: GraphThreadDocument) {
        if (rows.has(row._id)) throw Object.assign(new Error("Trùng phiên giả lập"), { code: 11000 });
        rows.set(row._id, structuredClone(row));
      },
      async findOneAndUpdate(query: Record<string, unknown>, operation: unknown) {
        const row = rows.get(String(query._id));
        if (!row || !matches(row, query)) return null;
        update(row, operation); return structuredClone(row);
      },
      async findOne(query: Record<string, unknown>) {
        const row = rows.get(String(query._id));
        return row && matches(row, query) ? structuredClone(row) : null;
      },
      async updateOne(query: Record<string, unknown>, operation: unknown, options?: { session?: unknown }) {
        if (name !== GRAPH_THREAD_COLLECTION) {
          assert.ok(options?.session, "Checkpoint phải có session transaction.");
          if (failCheckpoint) throw new Error("Lỗi ghi checkpoint giả lập");
          events.push({ collection: name, session: options.session, method: "updateOne" });
          return { matchedCount: 1 };
        }
        const row = rows.get(String(query._id));
        if (!row || !matches(row, query)) return { matchedCount: 0 };
        update(row, operation);
        if (options?.session) events.push({ collection: name, session: options.session, method: "fence" });
        return { matchedCount: 1 };
      },
      async bulkWrite(_operations: unknown, options?: { session?: unknown }) {
        assert.ok(options?.session, "Pending writes phải có session transaction.");
        events.push({ collection: name, session: options.session, method: "bulkWrite" });
      },
    };
  };
  const client = createGraphMongoClient("mongodb://127.0.0.1:27017/kiem_thu_khong_ket_noi");
  const database = { collection } as unknown as ReturnType<Client["db"]>;
  mock.method(client, "db", () => database);
  mock.method(client, "startSession", () => {
    const session = {
      async withTransaction<T>(runTransaction: () => Promise<T>) {
        const before = structuredClone(rows);
        const eventCount = events.length;
        try { return await runTransaction(); }
        catch (error) {
          rows.clear(); for (const [key, value] of before) rows.set(key, value);
          events.splice(eventCount); throw error;
        }
      },
      async endSession() {},
    };
    return session as unknown as ReturnType<Client["startSession"]>;
  });
  const accessA = new MongoGraphThreadAccess(client, 1000);
  const accessB = new MongoGraphThreadAccess(client, 1000);
  const saverA = new FencedMongoDBSaver(client, accessA);
  const saverB = new FencedMongoDBSaver(client, accessB);
  const user = { id: "khach-luu-tru", role: "CUSTOMER" as const };
  const checkpoint = emptyCheckpoint();
  const metadata = { source: "update" as const, step: 0, parents: {} };
  const config = (thread: string) => ({ configurable: { thread_id: thread, checkpoint_ns: "", checkpoint_id: checkpoint.id } });
  let threadId = "";
  await assert.rejects(saverA.put(config("gia-mao"), checkpoint, metadata));
  await assert.rejects(saverA.getTuple(config("gia-mao")));
  await assert.rejects(saverA.list({}).next());
  await assert.rejects(saverA.deleteThread("gia-mao"));
  await accessA.exclusive(user, "phien-ben-vung", async (thread) => {
    threadId = thread;
    await assert.rejects(accessB.exclusive(user, "phien-ben-vung", async () => undefined));
    await assert.rejects(saverA.put(config("thread-khac"), checkpoint, metadata));
    await saverA.put(config(thread), checkpoint, metadata);
    await saverA.putWrites(config(thread), [["data", { ketQua: "đã kiểm chứng" }]], "tac-vu");
    assert.equal(events.length, 4);
    assert.equal(events[0].session, events[1].session);
    assert.equal(events[2].session, events[3].session);
    assert.notEqual(events[0].session, events[2].session);
    assert.equal(events[1].collection, GRAPH_CHECKPOINT_COLLECTIONS.checkpoints);
    assert.equal(events[3].collection, GRAPH_CHECKPOINT_COLLECTIONS.writes);
    const before = structuredClone(rows.get("phien-ben-vung"));
    failCheckpoint = true;
    await assert.rejects(saverA.put(config(thread), checkpoint, metadata));
    failCheckpoint = false;
    assert.deepEqual(rows.get("phien-ben-vung"), before, "Ghi checkpoint lỗi phải rollback gia hạn/fence write.");
    // Hết lease, chủ mới lấy lại. Cả put và putWrites của tiến trình cũ đều bị chặn.
    clock += 1001;
    await accessB.exclusive(user, "phien-ben-vung", async (nextThread) => {
      assert.equal(nextThread, thread);
      assert.equal(rows.get("phien-ben-vung")?.fence, 2);
      await assert.rejects(saverA.put(config(thread), checkpoint, metadata));
      await assert.rejects(saverA.putWrites(config(thread), [["data", {}]], "cu"));
      await saverB.put(config(thread), checkpoint, metadata);
    });
  }).then(() => assert.fail("Chủ cũ mất khóa không được trả thành công."), (error: unknown) => {
    assert.ok(error instanceof AppError && error.statusCode === 409 && error.message.includes("mất quyền xử lý"));
  });
  assert.equal(rows.get("phien-ben-vung")?.fence, 2);
  await assert.rejects(accessB.exclusive({ ...user, id: "khach-khac" }, "phien-ben-vung", async () => undefined));
  await accessB.exclusive(user, "phien-ben-vung", async (thread) => {
    assert.equal(thread, threadId);
    assert.equal(rows.get("phien-ben-vung")?.fence, 3);
  });
  mock.restoreAll();
  await client.close();
  console.log("Đạt persistence giả lập: metadata/ownership, khóa nhiều instance, takeover, chặn chủ cũ, session chung cho checkpoint/pending writes, rollback và cấm xóa.");
}

void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
