import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { measureCustomerStage, observeCustomerTurn, type CustomerTurnMetric } from "../ai/runtime/customer-runtime-metrics";
import { CustomerMetricsSummary } from "../ai/runtime/customer-metrics-summary";
import { newSession } from "../ai/agent/agent-state";

async function run() {
  const events: CustomerTurnMetric[] = [];
  const session = newSession("phien-rieng-tu", "khach-rieng-tu");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let entered!: () => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const first = observeCustomerTurn(async () => {
    await measureCustomerStage("call_model", async () => {
      await measureCustomerStage("model_request", async () => { entered(); await gate; });
    });
    return session;
  }, (event) => events.push(event));
  await started;
  await observeCustomerTurn(async () => {
    await measureCustomerStage("checkpoint_write", async () => {});
    const error = new Error("Payload riêng tư không được ghi log.");
    await assert.rejects(measureCustomerStage("merge_messages", async () => { throw error; }), (value: unknown) => value === error);
    return session;
  }, (event) => events.push(event));
  release(); await first;
  assert.deepEqual(events[0].stages?.map((item) => item.stage), ["checkpoint_write", "merge_messages"]);
  assert.deepEqual(events[1].stages?.map((item) => item.stage), ["model_request", "call_model"]);
  assert.equal(events[0].stages?.find((item) => item.stage === "merge_messages")?.errors, 1);
  for (const event of events) for (const stage of event.stages ?? []) {
    assert.ok(stage.totalMs >= 0 && stage.maxMs <= stage.totalMs);
    assert.deepEqual(Object.keys(stage).sort(), ["count", "errors", "maxMs", "stage", "totalMs"]);
  }
  assert.ok(!JSON.stringify(events).includes("riêng tư"));
  assert.ok(!JSON.stringify(events).includes("rieng-tu"));
  // Công việc kết thúc sau khi lượt đã hủy không được thay đổi sự kiện đã phát.
  let finishLate!: () => void;
  const lateGate = new Promise<void>((resolve) => { finishLate = resolve; });
  let late!: Promise<void>;
  await observeCustomerTurn(async () => {
    late = measureCustomerStage("model_request", async () => { await lateGate; });
    return session;
  }, (event) => events.push(event));
  const beforeLate = JSON.stringify(events[2]); finishLate(); await late;
  assert.equal(JSON.stringify(events[2]), beforeLate);
  assert.equal(await measureCustomerStage("model_request", async () => 42), 42);
  assert.equal(await observeCustomerTurn(async () => session, () => { throw new Error("Lỗi logger fixture."); }), session);

  const summary = new CustomerMetricsSummary();
  assert.deepEqual(summary.report().latency, { p50Ms: null, p95Ms: null, maxMs: null });
  const base = { engine: "langgraph-customer", version: "customer-workflow-v1", outcome: "returned" };
  for (let value = 1; value <= 20; value++) summary.add({ ...base, durationMs: value,
    state: value === 20 ? "FAILED" : "COMPLETED", stages: [
      { stage: "model_request", count: 2, errors: 0, totalMs: value * 2, maxMs: value },
    ] });
  const report = summary.report();
  assert.equal(report.samples, 20);
  assert.deepEqual(report.latency, { p50Ms: 10, p95Ms: 19, maxMs: 20 });
  assert.equal(report.failed, 1);
  assert.equal(report.stages[0].count, 40);
  assert.deepEqual(report.stages[0].perTurn, { p50Ms: 20, p95Ms: 38, maxMs: 40 });
  summary.addLine(`2026-10-27 INFO [AgentCustomerRuntime] Kết quả. ${JSON.stringify({ ...base, durationMs: 5 })}`);
  summary.addLine("Dòng log khác chứa dữ liệu riêng tư.");
  summary.add({ ...base, durationMs: -1 });
  summary.add({ ...base, version: "khac", durationMs: 1 });
  summary.add({ ...base, durationMs: 1, stages: [{ stage: "ten-tool-rieng-tu", count: 1, errors: 0, totalMs: 1, maxMs: 1 }] });
  assert.equal(summary.report().samples, 21);
  assert.equal(summary.report().ignored, 4);
  assert.ok(!JSON.stringify(summary.report()).includes("rieng-tu"));
  // Chạy CLI thật để kiểm tra mã thoát cho giám sát, kể cả lỗi bước bị runtime bắt lại.
  const cli = (input: string, strict = true) => spawnSync(process.execPath,
    [join(__dirname, "summarizeAgentCustomerMetrics.js"), "-", ...(strict ? ["--fail-on-attention"] : [])],
    { input, encoding: "utf8", timeout: 5000 });
  const healthy = { ...base, durationMs: 1, state: "COMPLETED" };
  assert.equal(cli(JSON.stringify(healthy)).status, 0);
  assert.equal(cli("").status, 1);
  assert.equal(cli("Dòng không phải số đo.").status, 1);
  for (const event of [
    { ...healthy, state: "FAILED" }, { ...healthy, outcome: "error" },
    { ...healthy, requiresReconciliation: true }, { ...healthy, interrupted: true },
    { ...healthy, stages: [{ stage: "execute_read", count: 1, errors: 1, totalMs: 1, maxMs: 1 }] },
  ]) {
    const result = cli(JSON.stringify(event));
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stdout).samples, 1);
  }
  assert.equal(cli(JSON.stringify({ ...healthy, state: "FAILED" }), false).status, 0);
  const invalid = cli("Payload bí mật không được xuất lại.");
  assert.ok(!invalid.stdout.includes("Payload bí mật"));
  console.log("Đạt số đo agent: tách lượt đồng thời, node/model/checkpoint, lỗi, hủy muộn, riêng tư và tổng hợp p50/p95 từ log.");
}
void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
