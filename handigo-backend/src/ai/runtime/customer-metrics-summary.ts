import { z } from "zod";
import { CUSTOMER_GRAPH_VERSION } from "./mongo-graph-access";
import { CUSTOMER_RUNTIME_STAGES, type CustomerRuntimeStage } from "./customer-runtime-metrics";
import { modelUsageSchema } from "../llm/model-usage";
import type { ModelUsage } from "../llm/llm.interface";

export const modelRatesSchema = z.array(z.object({ provider: z.enum(["gemini", "openai", "claude"]),
  model: z.string().regex(/^[a-zA-Z0-9./:_-]{1,120}$/), inputUsdPerMillion: z.number().finite().nonnegative().max(1_000_000),
  outputUsdPerMillion: z.number().finite().nonnegative().max(1_000_000), cachedUsdPerMillion: z.number().finite().nonnegative().max(1_000_000),
  cacheWriteUsdPerMillion: z.number().finite().nonnegative().max(1_000_000) }).strict()).max(32)
  .refine((rates) => new Set(rates.map((rate) => `${rate.provider}:${rate.model}`)).size === rates.length);
export type ModelRates = z.infer<typeof modelRatesSchema>;

const duration = z.number().finite().nonnegative().max(3_600_000);
const stageSchema = z.object({ stage: z.enum(CUSTOMER_RUNTIME_STAGES), count: z.number().int().min(1).max(1_000_000),
  errors: z.number().int().nonnegative().max(1_000_000), totalMs: duration, maxMs: duration })
  .refine((item) => item.errors <= item.count && item.maxMs <= item.totalMs);
const metricSchema = z.object({ engine: z.literal("langgraph-customer"), version: z.literal(CUSTOMER_GRAPH_VERSION),
  durationMs: duration, outcome: z.enum(["returned", "rejected", "error"]),
  state: z.enum(["RUNNING", "WAITING_USER_INPUT", "WAITING_CONFIRMATION", "EXECUTING_TOOL", "COMPLETED", "FAILED"]).optional(),
  requiresReconciliation: z.boolean().optional(), interrupted: z.boolean().optional(),
  stages: z.array(stageSchema).max(CUSTOMER_RUNTIME_STAGES.length).optional(),
  usage: z.array(z.intersection(modelUsageSchema, z.object({ calls: z.number().int().positive().max(10000) }))).max(8).optional(),
}).refine((event) => new Set(event.stages?.map((item) => item.stage)).size === (event.stages?.length ?? 0));

const latency = (values: number[]) => {
  const ordered = [...values].sort((a, b) => a - b);
  const percentile = (fraction: number) => ordered.length ? ordered[Math.max(0, Math.ceil(fraction * ordered.length) - 1)] : null;
  return { p50Ms: percentile(0.5), p95Ms: percentile(0.95), maxMs: ordered.length ? ordered[ordered.length - 1] : null };
};

// Chỉ giữ số liệu tổng hợp trong bộ nhớ, giới hạn mẫu; không giữ dòng log hoặc payload gốc.
export class CustomerMetricsSummary {
  private readonly durations: number[] = [];
  private readonly outcomes = { returned: 0, rejected: 0, error: 0 };
  private readonly stages = new Map<CustomerRuntimeStage, { counts: number; errors: number; totals: number[] }>();
  private failed = 0;
  private reconciliation = 0;
  private interrupted = 0;
  private ignored = 0;
  private truncated = 0;
  private turnsWithUsage = 0;
  private readonly usage = new Map<string, ModelUsage & { calls: number }>();

  add(value: unknown) {
    const parsed = metricSchema.safeParse(value);
    if (!parsed.success) { this.ignored++; return; }
    if (this.durations.length >= 100_000) { this.truncated++; return; }
    const event = parsed.data;
    this.durations.push(event.durationMs);
    this.outcomes[event.outcome]++;
    this.failed += Number(event.state === "FAILED");
    this.reconciliation += Number(event.requiresReconciliation === true);
    this.interrupted += Number(event.interrupted === true);
    if (event.usage?.length) this.turnsWithUsage++;
    for (const source of event.usage ?? []) {
      const key = `${source.provider}:${source.model}`;
      // Giới hạn số model trong báo cáo để log cấu hình sai không tăng bộ nhớ không giới hạn.
      if (!this.usage.has(key) && this.usage.size >= 32) continue;
      const item = this.usage.get(key) ?? { ...source, calls: 0, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0 };
      item.calls += source.calls; item.inputTokens += source.inputTokens; item.outputTokens += source.outputTokens;
      item.cachedInputTokens += source.cachedInputTokens; item.cacheWriteTokens += source.cacheWriteTokens;
      this.usage.set(key, item);
    }
    for (const item of event.stages ?? []) {
      const stage = this.stages.get(item.stage) ?? { counts: 0, errors: 0, totals: [] };
      stage.counts += item.count; stage.errors += item.errors; stage.totals.push(item.totalMs);
      this.stages.set(item.stage, stage);
    }
  }

  addLine(line: string) {
    // Logger có tiền tố thời gian/mức/scope; chỉ lấy JSON, không in lại dòng bị lỗi.
    const start = line.indexOf("{");
    if (start < 0) { this.ignored++; return; }
    try { this.add(JSON.parse(line.slice(start))); } catch { this.ignored++; }
  }

  report(pricing: ModelRates = []) {
    const rates = modelRatesSchema.parse(pricing);
    return { engine: "langgraph-customer", version: CUSTOMER_GRAPH_VERSION, samples: this.durations.length,
      ignored: this.ignored, truncated: this.truncated, outcomes: { ...this.outcomes }, failed: this.failed,
      requiresReconciliation: this.reconciliation, interrupted: this.interrupted, latency: latency(this.durations),
      turnsWithUsage: this.turnsWithUsage,
      usage: [...this.usage.values()].map((item) => {
        const rate = rates.find((value) => value.provider === item.provider && value.model === item.model);
        const uncached = item.inputTokens - item.cachedInputTokens - item.cacheWriteTokens;
        return { ...item, estimatedUsd: rate ? (uncached * rate.inputUsdPerMillion + item.outputTokens * rate.outputUsdPerMillion
          + item.cachedInputTokens * rate.cachedUsdPerMillion + item.cacheWriteTokens * rate.cacheWriteUsdPerMillion) / 1_000_000 : null };
      }),
      attention: { failed: this.failed > 0, runtimeError: this.outcomes.error > 0, reconciliation: this.reconciliation > 0,
        interrupted: this.interrupted > 0, truncated: this.truncated > 0,
        stageError: [...this.stages.values()].some((item) => item.errors > 0) },
      stages: [...this.stages.entries()].map(([stage, item]) => ({ stage, turns: item.totals.length,
        count: item.counts, errors: item.errors, totalMs: item.totals.reduce((sum, value) => sum + value, 0),
        perTurn: latency(item.totals) })) };
  }
}
