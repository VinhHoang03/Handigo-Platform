import { createHash } from "node:crypto";
import { z } from "zod";
import { Command } from "@langchain/langgraph";
import type { RequestUser } from "../../middlewares/authContext";
import { AppError } from "../../utils/appError";
import { AGENT_REQUEST_TIMEOUT_MS } from "../agent/runtime-limits";
import { buildReadOnlyCustomerGraph, type ReadOnlyGraphDependencies } from "../graphs/customer.graph";
import { READ_ONLY_GRAPH_VERSION, type ReadOnlyGraphData } from "./graph-state";
import { projectReadOnlySession } from "./session-adapter";

const inputSchema = z.object({ requestId: z.string().trim().min(1).max(100),
  message: z.string().trim().min(1).max(6000) }).strict();
const sessionIdSchema = z.string().trim().min(1).max(100);

// Host chịu trách nhiệm ánh xạ phiên, quyền sở hữu và khóa xuyên suốt đọc/chạy/checkpoint.
// Không truyền thread_id/checkpoint_id/namespace do client chọn vào callback.
export interface GraphThreadAccess {
  exclusive<T>(user: RequestUser, sessionId: string,
    run: (threadId: string) => Promise<T>): Promise<T>;
}

/** Chỉ dùng thử nghiệm một tiến trình; không dùng làm khóa cho nhiều backend. */
export class InProcessGraphPilotAccess implements GraphThreadAccess {
  private readonly owners = new Map<string, string>();
  private readonly busy = new Set<string>();

  async exclusive<T>(user: RequestUser, sessionId: string, run: (threadId: string) => Promise<T>) {
    const owner = this.owners.get(sessionId);
    if (owner && owner !== user.id) throw new AppError("Không tìm thấy phiên trợ lý.", 404);
    if (this.busy.has(sessionId)) throw new AppError("Phiên đang xử lý. Vui lòng thử lại sau.", 409);
    this.owners.set(sessionId, user.id);
    this.busy.add(sessionId);
    const threadId = createHash("sha256").update(JSON.stringify([READ_ONLY_GRAPH_VERSION, user.id, sessionId])).digest("hex");
    try { return await run(threadId); }
    finally { this.busy.delete(sessionId); }
  }
}

export class ReadOnlyAgentRuntime {
  constructor(private readonly deps: Omit<ReadOnlyGraphDependencies, "user" | "signal">,
    private readonly access: GraphThreadAccess) {}

  async send(user: RequestUser, sessionId: string, rawInput: unknown, signal?: AbortSignal) {
    if (user.role !== "CUSTOMER") throw new AppError("Trợ lý hệ thống chỉ dành cho khách hàng.", 403);
    sessionId = sessionIdSchema.parse(sessionId);
    const input = inputSchema.parse(rawInput);
    const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(AGENT_REQUEST_TIMEOUT_MS)])
      : AbortSignal.timeout(AGENT_REQUEST_TIMEOUT_MS);
    return this.access.exclusive(user, sessionId, async (threadId) => {
      requestSignal.throwIfAborted();
      const graph = buildReadOnlyCustomerGraph({ ...this.deps, user, signal: requestSignal });
      const config = { configurable: { thread_id: threadId }, signal: requestSignal,
        recursionLimit: 32, durability: "sync" as const };
      const snapshot = await graph.getState(config);
      const previous: ReadOnlyGraphData | undefined = snapshot.values.data;
      if (previous && (previous.userId !== user.id || previous.sessionId !== sessionId
        || previous.version !== READ_ONLY_GRAPH_VERSION)) {
        throw new AppError("Checkpoint không khớp phiên hoặc phiên bản runtime.", 409);
      }
      const digest = createHash("sha256").update(JSON.stringify(input)).digest("hex");
      const receipt = previous?.receipts.find((item) => item.requestId === input.requestId);
      if (receipt) {
        if (receipt.digest !== digest) throw new AppError("Mã request đã được dùng với dữ liệu khác.", 409);
        return projectReadOnlySession(previous!);
      }
      if (previous?.turn.status === "running") {
        if (previous.turn.requestId !== input.requestId || previous.turn.digest !== digest) {
          throw new AppError("Vui lòng tiếp tục yêu cầu đang gián đoạn trước khi gửi yêu cầu mới.", 409);
        }
        // Tiếp tục từ node còn thiếu; không thêm lại tin nhắn hay phát lại đầu vào.
        const resumedGraph = buildReadOnlyCustomerGraph({ ...this.deps, user, signal: requestSignal, refreshOnResume: true });
        let interrupted = snapshot.tasks.some((task) => task.interrupts.length > 0);
        if (previous.turn.waitingForModelRetry && !interrupted) {
          // Crash có thể xảy ra sau checkpoint lỗi nhưng trước node interrupt.
          await resumedGraph.invoke(null, config);
          interrupted = (await resumedGraph.getState(config)).tasks.some((task) => task.interrupts.length > 0);
        }
        const result = await resumedGraph.invoke(interrupted ? new Command({ resume: true }) : null, config);
        return projectReadOnlySession(result.data);
      }
      if (previous && (previous.receipts.length >= 128 || Buffer.byteLength(JSON.stringify(previous), "utf8") > 1_000_000)) {
        throw new AppError("Phiên đã đầy. Vui lòng bắt đầu phiên mới để tiếp tục tra cứu.", 409);
      }
      const data: ReadOnlyGraphData = {
        version: READ_ONLY_GRAPH_VERSION, sessionId, userId: user.id,
        conversation: [...(previous?.conversation ?? []), { id: `${input.requestId}:user`, role: "user",
          content: input.message, createdAt: new Date().toISOString() }],
        receipts: previous?.receipts ?? [], state: "RUNNING",
        turn: { ...input, digest, iterations: 0, status: "running" },
      };
      const result = await graph.invoke({ data }, config);
      return projectReadOnlySession(result.data);
    });
  }
}
