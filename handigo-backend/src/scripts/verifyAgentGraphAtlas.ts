import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { emptyCheckpoint } from "@langchain/langgraph";
import { z } from "zod";
import { createPersistentGraphConnection, GRAPH_THREAD_COLLECTION, type GraphThreadDocument } from "../ai/runtime/mongo-graph-access";
import { createGraphMongoClient } from "../ai/runtime/checkpoint";
import { ReadOnlyAgentRuntime } from "../ai/runtime/agent-runtime";
import { ToolRegistry } from "../ai/tools/tool-registry";

const user = { id: "kiem-thu-graph-atlas", role: "CUSTOMER" as const };
const input = { requestId: "kiem-thu-khoi-dong-lai", message: "Kiểm thử lưu checkpoint riêng của AI." };
const reply = "Checkpoint kiểm thử đã được lưu.";
type Stage = "write" | "read" | "interrupt" | "resume" | "crash" | "model-timeout" | "model-resume";

async function child(uri: string, stage: Stage, sessionId: string) {
  await new Promise<void>((resolve, reject) => {
    const processChild = spawn(process.execPath, [__filename, stage, sessionId], {
      env: { ...process.env, MONGO_URI: uri }, stdio: "ignore", timeout: 60000,
    });
    processChild.once("error", reject);
    processChild.once("close", (code) => code === 0 ? resolve() : reject(new Error("Tiến trình kiểm chứng checkpoint chưa đạt.")));
  });
}

async function verifyChild(uri: string, stage: Stage, sessionId: string) {
  const connection = createPersistentGraphConnection(uri, stage === "crash" ? 5000 : undefined);
  try {
    await connection.setup();
    let modelCalls = 0;
    let reads = 0;
    const controller = new AbortController();
    const registry = new ToolRegistry().register({ name: "search_customer_knowledge", description: "Nguồn giả lập kiểm thử persistence.",
      roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false, inputSchema: z.object({}).strict(),
      async execute() { reads++; return { articles: [] }; } });
    const runtime = new ReadOnlyAgentRuntime({ checkpointer: connection.saver, registry, provider: {
      async generate() {
        modelCalls++;
        if (stage === "interrupt" || stage === "crash" || stage === "model-timeout") {
          if (modelCalls === 1) return { type: "TOOL_CALL", tool: "search_customer_knowledge", arguments: {} };
          if (stage === "model-timeout") throw new DOMException("Timeout model fixture sau checkpoint nguồn.", "TimeoutError");
          if (stage === "crash") {
            // Node model thứ hai chỉ bắt đầu sau checkpoint tool ở chế độ durability=sync.
            if (!process.send) throw new Error("Ca crash cần kênh IPC của tiến trình kiểm thử.");
            process.send({ phase: "checkpoint-ready", reads, modelCalls });
            await new Promise<never>(() => undefined);
          }
          controller.abort();
          throw new Error("Gián đoạn giả lập sau khi lưu kết quả tool.");
        }
        return { type: "FINAL", message: reply };
      },
    } }, connection.access);
    if (stage === "interrupt") {
      await assert.rejects(runtime.send(user, sessionId, input, controller.signal));
      assert.equal(modelCalls, 2);
      assert.equal(reads, 1);
      return;
    }
    const result = await runtime.send(user, sessionId, input);
    if (stage === "model-timeout") {
      assert.equal(result.state, "FAILED");
      assert.equal(result.activeRequest?.requestId, input.requestId);
      assert.equal(result.receipts.length, 0);
      assert.equal(modelCalls, 2); assert.equal(reads, 1);
      assert.equal((await connection.get(sessionId, user.id)).activeRequest?.requestId, input.requestId);
      return;
    }
    assert.equal(result.state, "COMPLETED");
    assert.equal(result.conversation.filter((message) => message.role === "user").length, 1);
    assert.equal(result.conversation[result.conversation.length - 1].content, reply);
    assert.equal(modelCalls, stage === "read" ? 0 : 1);
    assert.equal(reads, stage === "resume" || stage === "model-resume" ? 1 : 0);
    assert.equal(result.receipts.length, 1);
  } finally { await connection.close(); }
}

export async function verifyAgentGraphModelRecoveryAtlas(uri: string) {
  if (!__filename.endsWith(".js")) throw new Error("Cần build backend trước khi kiểm chứng phục hồi model.");
  const sessionId = `kiem-thu-restart-${randomUUID()}`;
  await child(uri, "model-timeout", sessionId);
  await child(uri, "model-resume", sessionId);
  await child(uri, "read", sessionId);
  return { modelTimeoutPaused: true, resumedAcrossProcesses: true, sourceRefreshed: true,
    receiptOnlyWhenCompleted: true, replayNoWork: true, businessWrites: 0, deletedDocuments: 0 };
}

// Chỉ tắt tiến trình Node do chính ca kiểm thử này tạo; không gửi tín hiệu đến backend đang chạy.
export async function verifyAgentGraphCrashAtlas(uri: string) {
  if (!__filename.endsWith(".js")) throw new Error("Cần build backend trước khi kiểm chứng crash.");
  const sessionId = `kiem-thu-restart-${randomUUID()}`;
  const processChild = spawn(process.execPath, [__filename, "crash", sessionId], {
    env: { ...process.env, MONGO_URI: uri }, stdio: ["ignore", "ignore", "ignore", "ipc"],
    windowsHide: true, timeout: 45000,
  });
  const closed = new Promise<void>((resolve) => processChild.once("close", () => resolve()));
  const storage = createPersistentGraphConnection(uri);
  try {
    await new Promise<void>((resolve, reject) => {
      processChild.once("error", reject);
      processChild.once("close", () => reject(new Error("Tiến trình fixture dừng trước checkpoint cần kiểm tra.")));
      processChild.once("message", (message) => {
        const parsed = z.object({ phase: z.literal("checkpoint-ready"), reads: z.literal(1), modelCalls: z.literal(2) }).safeParse(message);
        if (parsed.success) resolve(); else reject(new Error("Tiến trình fixture báo trạng thái checkpoint không hợp lệ."));
      });
    });
    assert.ok(processChild.kill("SIGKILL"), "Phải tắt được tiến trình fixture đang chờ sau checkpoint.");
    await closed;
    await storage.open();
    const interrupted = await storage.get(sessionId, user.id);
    assert.equal(interrupted.activeRequest?.requestId, input.requestId);
    await delay(5200);
    let reads = 0;
    let models = 0;
    const registry = new ToolRegistry().register({ name: "search_customer_knowledge", description: "Nguồn fixture sau crash.",
      roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false, inputSchema: z.object({}).strict(),
      async execute() { reads++; return { articles: [] }; } });
    const runtime = new ReadOnlyAgentRuntime({ registry, checkpointer: storage.saver, provider: {
      async generate() { models++; return { type: "FINAL", message: reply }; },
    } }, storage.access);
    const result = await runtime.send(user, sessionId, input);
    assert.equal(result.state, "COMPLETED");
    assert.equal(result.conversation.filter((message) => message.role === "user").length, 1);
    assert.equal(result.receipts.length, 1);
    assert.equal(reads, 1);
    assert.equal(models, 1);
    await runtime.send(user, sessionId, input);
    assert.equal(reads, 1); assert.equal(models, 1);
    return { hardKillFixture: true, resumedFromAtlas: true, expiredLeaseTakenOver: true, refreshedRead: true,
      oneUserMessage: true, replayNoWork: true, businessWrites: 0, deletedDocuments: 0 };
  } finally {
    if (processChild.exitCode === null && processChild.signalCode === null) processChild.kill("SIGKILL");
    await closed;
    await storage.close();
  }
}

// Chỉ tạo dữ liệu kiểm thử trong ba collection graph; không đọc/ghi dữ liệu nghiệp vụ, không xóa.
export async function verifyAgentGraphAtlas(uri: string) {
  if (!__filename.endsWith(".js")) throw new Error("Cần build backend trước khi kiểm chứng Atlas.");
  const sessionId = `kiem-thu-restart-${randomUUID()}`;
  await child(uri, "write", sessionId);
  await child(uri, "read", sessionId);
  const interruptedSession = `kiem-thu-restart-${randomUUID()}`;
  await child(uri, "interrupt", interruptedSession);
  await child(uri, "resume", interruptedSession);
  const first = createPersistentGraphConnection(uri, 2500);
  const second = createPersistentGraphConnection(uri);
  const inspector = createGraphMongoClient(uri);
  try {
    await first.setup();
    await second.setup();
    await inspector.connect();
    const fenceSession = `kiem-thu-fence-${randomUUID()}`;
    let started!: () => void;
    let resumeOld!: () => void;
    const entered = new Promise<void>((resolve) => { started = resolve; });
    const oldGate = new Promise<void>((resolve) => { resumeOld = resolve; });
    const endedOld = new Error("Dừng tiến trình cũ sau khi kiểm tra fencing.");
    let oldThread = "";
    const oldCheckpoint = emptyCheckpoint();
    const metadata = { source: "update" as const, step: 0, parents: {} };
    const config = (threadId: string) => ({ configurable: { thread_id: threadId, checkpoint_ns: "" } });
    const oldTask = first.access.exclusive(user, fenceSession, async (threadId) => {
      oldThread = threadId;
      await first.saver.put(config(threadId), oldCheckpoint, metadata);
      started();
      await oldGate;
      await assert.rejects(first.saver.put(config(threadId), oldCheckpoint, metadata));
      await assert.rejects(first.saver.putWrites({ configurable: { ...config(threadId).configurable,
        checkpoint_id: oldCheckpoint.id } }, [["data", { stale: true }]], "tac-vu-cu"));
      throw endedOld;
    });
    const oldDone = oldTask.then(() => assert.fail("Tiến trình cũ không được hoàn tất sau khi mất khóa."),
      (error: unknown) => { assert.equal(error, endedOld); });
    // Nếu acquire/ghi đầu lỗi thì không chờ vô hạn trước tín hiệu entered.
    await Promise.race([entered, oldDone.then(() => { throw new Error("Không bắt đầu được ca fencing."); })]);
    await assert.rejects(second.access.exclusive(user, fenceSession, async () => undefined));
    await assert.rejects(second.access.exclusive({ ...user, id: "khach-khac" }, fenceSession, async () => undefined));
    await delay(2700);
    await second.access.exclusive(user, fenceSession, async (threadId) => {
      assert.equal(threadId, oldThread);
      resumeOld();
      await oldDone;
      const checkpoint = emptyCheckpoint();
      checkpoint.channel_values = { ketQua: "Chủ mới vẫn giữ khóa sau khi chủ cũ nhả khóa." };
      await second.saver.put(config(threadId), checkpoint, metadata);
      const saved = await second.saver.getTuple(config(threadId));
      assert.equal(saved?.checkpoint.id, checkpoint.id);
      assert.deepEqual(saved?.checkpoint.channel_values, checkpoint.channel_values);
      const oldSaved = await second.saver.getTuple({ configurable: { ...config(threadId).configurable,
        checkpoint_id: oldCheckpoint.id } });
      assert.equal(oldSaved?.pendingWrites?.length, 0);
      const threads = inspector.db().collection<GraphThreadDocument>(GRAPH_THREAD_COLLECTION);
      const before = await threads.findOne({ _id: fenceSession });
      const invalid = emptyCheckpoint();
      Object.defineProperty(invalid, "channel_values", { enumerable: true,
        get() { throw new Error("Lỗi tuần tự hóa giả lập sau khi khóa metadata trong transaction."); } });
      await assert.rejects(second.saver.put(config(threadId), invalid, metadata));
      const after = await threads.findOne({ _id: fenceSession });
      assert.deepEqual(after, before, "Lỗi checkpoint phải rollback cả cập nhật metadata/gia hạn lease trên Atlas.");
    });
    return { restartAcrossProcesses: true, receiptReplay: true, interruptedTurnResumedAcrossProcesses: true, concurrentLockBlocked: true,
      wrongOwnerBlocked: true, staleCheckpointBlocked: true, stalePendingWritesBlocked: true,
      staleReleaseSafe: true, transactionRollback: true, businessWrites: 0, deletedDocuments: 0 };
  } finally { await first.close(); await second.close(); await inspector.close(); }
}

if (require.main === module) {
  void (async () => {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("Cần cấp MONGO_URI cho tiến trình; chương trình không tự đọc .env.");
    const stage = process.argv[2];
    if (stage === "write" || stage === "read" || stage === "interrupt" || stage === "resume" || stage === "crash"
      || stage === "model-timeout" || stage === "model-resume") {
      const sessionId = process.argv[3];
      if (!sessionId?.startsWith("kiem-thu-restart-")) throw new Error("Chỉ nhận mã phiên kiểm thử.");
      await verifyChild(uri, stage, sessionId);
    } else if (stage === "verify-model-recovery") {
      console.log(JSON.stringify(await verifyAgentGraphModelRecoveryAtlas(uri)));
    } else if (stage === "verify-crash") {
      console.log(JSON.stringify(await verifyAgentGraphCrashAtlas(uri)));
    } else if (!stage || stage === "verify") {
      console.log(JSON.stringify(await verifyAgentGraphAtlas(uri)));
    } else throw new Error("Chỉ hỗ trợ lệnh verify, verify-crash hoặc verify-model-recovery.");
  })().catch((error: unknown) => {
    // Không in lỗi driver/assertion có thể chứa URI hoặc dữ liệu kết nối.
    console.error("Kiểm chứng checkpoint Atlas chưa đạt.", { type: error instanceof Error ? error.name : "unknown" });
    process.exitCode = 1;
  });
}
