import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createGraphMongoClient } from "../ai/runtime/checkpoint";
import { MongoActionLedger } from "../ai/runtime/mongo-action-ledger";
import { actionIdentity } from "../ai/runtime/action-ledger";
import type { PendingAction } from "../ai/agent/agent-state";

export async function verifyAgentActionLedgerAtlas(uri: string) {
  const client = createGraphMongoClient(uri);
  const secondClient = createGraphMongoClient(uri);
  try {
    await Promise.all([client.connect(), secondClient.connect()]);
    const first = new MongoActionLedger(client), second = new MongoActionLedger(secondClient);
    await first.setup();
    await second.assertReady();
    const sessionId = `kiem-thu-action-${randomUUID()}`;
    const action: PendingAction = { id: randomUUID(), taskVersion: 0, tool: "create_booking", arguments: { fixture: true },
      preview: { fixture: true }, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(), status: "WAITING_CONFIRMATION" };
    const identity = actionIdentity("khach-fixture-action", sessionId, "booking", action);
    const another = actionIdentity(identity.userId, sessionId, "booking", { ...action, id: randomUUID() });
    const otherOwner = actionIdentity("chu-fixture-khac", sessionId, "booking", action);
    try {
      const reservations = await Promise.all([first.reserve(identity), second.reserve(identity), first.reserve(identity)]);
      assert.equal(reservations.filter((item) => item.inserted).length, 1);
      await assert.rejects(second.reserve(another));
      await assert.rejects(second.find({ ...identity, digest: "digest-khong-khop" }));
      await first.settle(identity, "UNKNOWN");
      await assert.rejects(second.reserve(another));
      await second.settle(identity, "SUCCEEDED", { fixture: true, message: "Kết quả fixture, không có đơn nghiệp vụ." });
      assert.equal((await first.find(identity))?.status, "SUCCEEDED");
      assert.equal((await first.settle(identity, "UNKNOWN"))?.status, "SUCCEEDED");
      assert.equal((await second.reserve(identity)).inserted, false);
      assert.equal((await second.reserve(another)).inserted, true);
      assert.equal((await first.reserve(otherOwner)).inserted, true);
      await second.settle(another, "EXPIRED");
      await first.settle(otherOwner, "EXPIRED");
      return { concurrentReservation: true, unresolvedBlocksNext: true, digestMismatchBlocked: true,
        crossClientRecovery: true, terminalCannotDowngrade: true, ownerIsolation: true,
        businessWrites: 0, deletedDocuments: 0 };
    } finally {
      // Chỉ kết thúc các fixture của lần chạy này; không xóa document hoặc mở khóa dữ liệu khác.
      for (const item of [identity, another, otherOwner]) {
        const record = await first.find(item).catch(() => null);
        if (record?.active) await first.settle(item, "EXPIRED");
      }
    }
  } finally { await Promise.all([client.close(), secondClient.close()]); }
}

if (require.main === module) {
  void (async () => {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("Cần cấp MONGO_URI cho tiến trình; chương trình không tự đọc .env.");
    console.log(JSON.stringify(await verifyAgentActionLedgerAtlas(uri)));
  })().catch((error: unknown) => {
    console.error("Kiểm chứng sổ hành động Atlas chưa đạt.", { type: error instanceof Error ? error.name : "unknown" });
    process.exitCode = 1;
  });
}
