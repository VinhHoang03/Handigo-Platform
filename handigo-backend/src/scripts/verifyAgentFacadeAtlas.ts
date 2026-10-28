import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { newSession } from "../ai/agent/agent-state";
import { createPersistentGraphConnection, type GraphThreadDocument } from "../ai/runtime/mongo-graph-access";
import { ReadOnlyAgentRuntime } from "../ai/runtime/agent-runtime";
import { ToolRegistry } from "../ai/tools/tool-registry";

// Chỉ tạo fixture trong collection AI; không dùng connectDB có cleanup, không xóa dữ liệu.
export async function verifyAgentFacadeAtlas(uri: string) {
  require.cache[require.resolve("../configs/payos.config")] = { exports: { payos: {}, payoutPayos: {} } } as NodeModule;
  const { AgentFacade } = await import("../ai/runtime/agent-facade");
  const { SessionService } = await import("../ai/session/session.service");
  const { sessionView } = await import("../ai/agent/agent.service");
  const connection = createPersistentGraphConnection(uri);
  try {
    await mongoose.connect(uri, { autoCreate: false, autoIndex: false, serverSelectionTimeoutMS: 12000 });
    await connection.open();
    const owner = randomUUID().replace(/-/g, "").slice(0, 24);
    const user = { id: owner, role: "CUSTOMER" as const };
    const directory = new SessionService();
    let pilot = true;
    let models = 0;
    let legacy = 0;
    const runtime = new ReadOnlyAgentRuntime({ checkpointer: connection.saver, registry: new ToolRegistry(), provider: {
      async generate() { models++; return { type: "FINAL", message: "Kết quả fixture facade." }; },
    } }, connection.access);
    const facade = new AgentFacade(directory, async () => ({ get: connection.get,
      exclusive: (customer, id, runExclusive) => connection.access.exclusive(customer, id, () => runExclusive()),
      send: (customer, id, input) => runtime.send(customer, id, input) }), async (customer, id) => {
      legacy++; return sessionView(newSession(id, customer.id));
    }, () => pilot ? "langgraph-readonly" : "legacy");
    const graphId = randomUUID();
    const request = { requestId: randomUUID(), message: "Kiểm thử facade và nguồn checkpoint." };
    await facade.send(user, graphId, request);
    assert.equal(models, 1);
    pilot = false;
    await facade.send(user, graphId, request);
    assert.equal(models, 1, "Receipt/engine đã ghim phải còn hiệu lực khi ngừng mở pilot.");
    const locked = await directory.acquireEngine(graphId, owner, "langgraph-readonly");
    try {
      // GET phải đọc được checkpoint khi khóa ghi đang giữ, không tranh khóa với POST.
      assert.equal((await facade.get(user, graphId)).state, "COMPLETED");
      await directory.saveGraphProjection(newSession(graphId, owner), locked.lockId);
    } finally { await directory.release(graphId, locked.lockId); }
    assert.equal((await facade.get(user, graphId)).conversation[0].content, request.message);
    const list = await facade.list(user, 1, 20);
    assert.equal(list.items[0]?.title, request.message);
    assert.ok(!("engine" in list.items[0]));
    assert.equal((await facade.latest(user))?.state, "COMPLETED");
    assert.equal((await facade.progress(user, graphId)).state, "COMPLETED");
    await assert.rejects(facade.get({ ...user, id: "000000000000000000000000" }, graphId));
    await assert.rejects(facade.send(user, graphId, { requestId: randomUUID(), paymentStatus: { orderId: "000000000000000000000000" } }));
    await assert.rejects(facade.requireAttachmentSupport(user, graphId));
    await assert.rejects(directory.acquire(graphId, owner), "Legacy không được lấy khóa phiên graph.");
    const reset = await facade.reset(user, graphId);
    assert.equal(await directory.resolveEngine(reset.id, owner), "legacy");
    pilot = true;
    await facade.send(user, reset.id, request);
    assert.equal(legacy, 1, "Phiên legacy đã ghim không đổi theo cấu hình pilot.");
    const database = mongoose.connection.db;
    assert.ok(database);
    const oldId = randomUUID();
    type LegacyFixture = { _id: string; userId: string; data: ReturnType<typeof newSession>; lockId: null;
      lockedUntil: Date; deletedAt: null; createdAt: Date; updatedAt: Date };
    await database.collection<LegacyFixture>("ai_agent_sessions").insertOne({ _id: oldId, userId: owner,
      data: newSession(oldId, owner), lockId: null, lockedUntil: new Date(0), deletedAt: null,
      createdAt: new Date(), updatedAt: new Date() });
    assert.equal(await directory.resolveEngine(oldId, owner, "langgraph-readonly"), "legacy");
    await facade.send(user, oldId, request);
    assert.equal(legacy, 2, "Phiên cũ thiếu engine và deletedAt=null vẫn tiếp tục legacy.");
    const raceId = randomUUID();
    const race = await Promise.all([directory.resolveEngine(raceId, owner, "langgraph-readonly"), directory.resolveEngine(raceId, owner, "legacy")]);
    assert.equal(race[0], race[1]);
    const threads = database.collection<GraphThreadDocument>("ai_graph_threads");
    const metadata = await threads.findOne({ _id: graphId });
    assert.ok(metadata?.threadId);
    const chunks = mongoose.connection.collection("ai_graph_checkpoints");
    const before = await chunks.countDocuments({ thread_id: metadata.threadId });
    await facade.delete(user, graphId);
    assert.equal(await chunks.countDocuments({ thread_id: metadata.threadId }), before);
    await assert.rejects(facade.get(user, graphId));
    await assert.rejects(facade.send(user, graphId, request));
    assert.ok(!(await facade.list(user, 1, 20)).items.some((item) => item.sessionId === graphId));
    return { enginePinned: true, racePinnedOnce: true, graphReadsDuringWriteLock: true, canonicalCheckpointReads: true,
      replayAfterPilotDisabled: true, legacyPreserved: true, lifecycle: true, softDeleteRetainsCheckpoint: true,
      unsupportedWritesBlocked: true, businessWrites: 0, deletedDocuments: 0 };
  } finally { await connection.close(); await mongoose.disconnect(); }
}

if (require.main === module) {
  void (async () => {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("Chưa được cấp MONGO_URI; không tự đọc .env.");
    console.log(JSON.stringify(await verifyAgentFacadeAtlas(uri)));
  })().catch((error: unknown) => {
    console.error("Kiểm chứng facade Atlas chưa đạt.", { type: error instanceof Error ? error.name : "unknown" });
    process.exitCode = 1;
  });
}
