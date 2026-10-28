import { performance } from "node:perf_hooks";
import { AsyncLocalStorage } from "node:async_hooks";
import { createLogger } from "../../utils/logger";
import { AppError } from "../../utils/appError";
import type { AgentSession } from "../agent/agent-state";
import { CUSTOMER_GRAPH_VERSION } from "./mongo-graph-access";
import type { ModelUsage } from "../llm/llm.interface";
import { modelUsageSchema } from "../llm/model-usage";

const logger = createLogger("AgentCustomerRuntime");
export const CUSTOMER_RUNTIME_STAGES = ["route_request", "compact_context", "call_model", "route_tool", "validate_tool",
  "prepare_confirmation", "execute_read", "after_tool", "prepare_draft", "apply_address", "respond",
  "refresh_sources", "history_request", "voucher_request", "recover_draft", "recover_address",
  "model_request", "checkpoint_read", "checkpoint_write", "merge_messages", "action_graph"] as const;
export type CustomerRuntimeStage = typeof CUSTOMER_RUNTIME_STAGES[number];
export interface CustomerStageMetric {
  stage: CustomerRuntimeStage;
  count: number;
  errors: number;
  totalMs: number;
  maxMs: number;
}
const timings = new AsyncLocalStorage<{ stages: Map<CustomerRuntimeStage, CustomerStageMetric>;
  usage: Map<string, ModelUsage & { calls: number }>; closed: boolean }>();
const allowedStages = new Set<string>(CUSTOMER_RUNTIME_STAGES);

export function recordCustomerModelUsage(value: ModelUsage) {
  const scope = timings.getStore(), parsed = modelUsageSchema.safeParse(value);
  if (!scope || scope.closed || !parsed.success) return;
  const usage = parsed.data, key = `${usage.provider}:${usage.model}`;
  if (!scope.usage.has(key) && scope.usage.size >= 8) return;
  const item = scope.usage.get(key) ?? { ...usage, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0, calls: 0 };
  item.calls++; item.inputTokens += usage.inputTokens; item.outputTokens += usage.outputTokens;
  item.cachedInputTokens += usage.cachedInputTokens; item.cacheWriteTokens += usage.cacheWriteTokens;
  scope.usage.set(key, item);
}

export async function measureCustomerStage<T>(stage: CustomerRuntimeStage, run: () => Promise<T>): Promise<T> {
  const scope = timings.getStore();
  if (!scope || scope.closed || !allowedStages.has(stage)) return run();
  const start = performance.now();
  let failed = false;
  try { return await run(); }
  catch (error) { failed = true; throw error; }
  finally {
    // Lời gọi đã hủy có thể kết thúc muộn; không sửa sự kiện của lượt đã phát.
    if (!scope.closed) {
      const elapsed = Math.max(0, performance.now() - start);
      const item = scope.stages.get(stage) ?? { stage, count: 0, errors: 0, totalMs: 0, maxMs: 0 };
      item.count++; item.errors += Number(failed); item.totalMs += elapsed; item.maxMs = Math.max(item.maxMs, elapsed);
      scope.stages.set(stage, item);
    }
  }
}
export interface CustomerTurnMetric {
  engine: "langgraph-customer";
  version: typeof CUSTOMER_GRAPH_VERSION;
  durationMs: number;
  outcome: "returned" | "rejected" | "error";
  state?: AgentSession["state"];
  requiresReconciliation?: boolean;
  interrupted?: boolean;
  stages?: CustomerStageMetric[];
  usage?: Array<ModelUsage & { calls: number }>;
}

export async function observeCustomerTurn(run: () => Promise<AgentSession>,
  emit: (event: CustomerTurnMetric) => void = (event) => {
    if (event.outcome === "error" || event.state === "FAILED" || event.requiresReconciliation || event.interrupted) logger.warn("Lượt trợ lý cần kiểm tra vận hành.", { ...event });
    else logger.info("Đã ghi nhận kết quả lượt trợ lý.", { ...event });
  }) {
  const scope = { stages: new Map<CustomerRuntimeStage, CustomerStageMetric>(),
    usage: new Map<string, ModelUsage & { calls: number }>(), closed: false };
  return timings.run(scope, async () => {
    const start = performance.now();
    const event: CustomerTurnMetric = { engine: "langgraph-customer", version: CUSTOMER_GRAPH_VERSION, durationMs: 0, outcome: "error" };
    try {
      const session = await run();
      event.outcome = "returned";
      event.state = session.state;
      event.requiresReconciliation = session.requiresReconciliation;
      event.interrupted = Boolean(session.activeRequest);
      return session;
    } catch (error) {
      event.outcome = error instanceof AppError && error.statusCode < 500 ? "rejected" : "error";
      throw error;
    } finally {
      scope.closed = true;
      event.durationMs = Math.max(0, Math.round(performance.now() - start));
      if (scope.stages.size) event.stages = [...scope.stages.values()].map((item) => ({ ...item,
        totalMs: Math.round(item.totalMs), maxMs: Math.round(item.maxMs) }));
      if (scope.usage.size) event.usage = [...scope.usage.values()].map((item) => ({ ...item }));
      // Chỉ phát metadata cố định; không đưa ID, hội thoại, tool args/result hoặc lỗi gốc vào log.
      try { emit(event); } catch { /* Hệ thống log lỗi không được làm mất kết quả nghiệp vụ. */ }
    }
  });
}
