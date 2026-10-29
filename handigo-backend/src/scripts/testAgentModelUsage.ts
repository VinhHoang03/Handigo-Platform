import assert from "node:assert/strict";
import { mock } from "node:test";
import type { LLMRequest, ModelUsage } from "../ai/llm/llm.interface";
import { reportModelUsage } from "../ai/llm/model-usage";
import { GeminiProvider } from "../ai/llm/providers/gemini.provider";
import { OpenAIProvider } from "../ai/llm/providers/openai.provider";
import { ClaudeProvider } from "../ai/llm/providers/claude.provider";
import { observeCustomerTurn, recordCustomerModelUsage, type CustomerTurnMetric } from "../ai/runtime/customer-runtime-metrics";
import { CustomerMetricsSummary } from "../ai/runtime/customer-metrics-summary";
import { renderCustomerMetricsReport } from "../ai/runtime/customer-metrics-html";
import { newSession } from "../ai/agent/agent-state";

async function run() {
  const config = { apiKey: "fixture-key", model: "fixture-model", temperature: 0, timeoutMs: 1000 };
  const response = { type: "FINAL", message: "Đã xử lý fixture." };
  const cases = [
    { provider: new GeminiProvider(config), body: { candidates: [{ finishReason: "STOP", content: { parts: [
      { functionCall: { name: "respond_to_customer", args: response } },
    ] } }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 10, thoughtsTokenCount: 5, cachedContentTokenCount: 20 } }, input: 100, output: 15 },
    { provider: new OpenAIProvider(config), body: { choices: [{ finish_reason: "tool_calls", message: { tool_calls: [
      { type: "function", function: { name: "respond_to_customer", arguments: JSON.stringify(response) } },
    ] } }], usage: { prompt_tokens: 100, completion_tokens: 15, prompt_tokens_details: { cached_tokens: 20 } } }, input: 100, output: 15 },
    { provider: new ClaudeProvider(config), body: { stop_reason: "tool_use", content: [
      { type: "tool_use", name: "respond_to_customer", input: response },
    ], usage: { input_tokens: 70, cache_read_input_tokens: 20, cache_creation_input_tokens: 10, output_tokens: 15 } }, input: 100, output: 15 },
  ];
  const events: CustomerTurnMetric[] = [];
  try {
    for (const test of cases) {
      const fetchMock = mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(test.body), {
        status: 200, headers: { "content-type": "application/json" },
      }));
      await observeCustomerTurn(async () => {
        const result = await test.provider.generate({ system: "Kiểm thử.", goal: "Kiểm thử.", conversation: [], tools: [],
          signal: AbortSignal.timeout(1000), onUsage: recordCustomerModelUsage });
        assert.deepEqual(result, response);
        return newSession("fixture", "fixture");
      }, (event) => events.push(event));
      fetchMock.mock.restore();
      assert.equal(events[events.length - 1].usage?.[0].inputTokens, test.input);
      assert.equal(events[events.length - 1].usage?.[0].outputTokens, test.output);
    }
    const values: ModelUsage[] = [];
    const request: LLMRequest = { system: "", goal: "", conversation: [], tools: [], signal: AbortSignal.timeout(1000), onUsage: (usage) => values.push(usage) };
    reportModelUsage(request, "gemini", "fixture-model", {});
    reportModelUsage(request, "gemini", "fixture-model", { usageMetadata: { promptTokenCount: 100, candidatesTokenCount: -10, thoughtsTokenCount: 20 } });
    assert.equal(values.length, 0, "Thiếu/sai metadata không được coi là 0 token.");
    assert.doesNotThrow(() => reportModelUsage({ ...request, onUsage: () => { throw new Error("Lỗi observer."); } }, "openai", "fixture-model", cases[1].body));
    const summary = new CustomerMetricsSummary(); events.forEach((event) => summary.add(event));
    assert.equal(summary.report().turnsWithUsage, 3);
    assert.equal(summary.report().usage.length, 3);
    assert.ok(summary.report().usage.every((usage) => usage.estimatedUsd === null));
    const rates = events.map((event) => ({ provider: event.usage![0].provider, model: "fixture-model", inputUsdPerMillion: 1,
      outputUsdPerMillion: 2, cachedUsdPerMillion: 0.5, cacheWriteUsdPerMillion: 1.5 }));
    const report = summary.report(rates);
    assert.equal(report.usage[0].estimatedUsd, 0.00012);
    assert.equal(report.usage[2].estimatedUsd, 0.000125);
    const html = renderCustomerMetricsReport(report);
    assert.ok(html.includes('lang="vi"')); assert.ok(!html.includes("<script"));
    assert.ok(!html.includes("fixture-key")); assert.ok(!html.includes(response.message));
    const escaped = renderCustomerMetricsReport({ ...report, version: '<script>alert("x")</script>' as never });
    assert.ok(!escaped.includes('<script>alert')); assert.ok(escaped.includes("&lt;script&gt;"));
    assert.ok(!JSON.stringify(events).includes("fixture-key"));
    console.log("Đạt usage: ba adapter thật/fetch fixture, token cache/suy luận, thiếu metadata, chi phí cấu hình, báo cáo HTML và không lộ payload/key.");
  } finally { mock.restoreAll(); }
}
void run().catch((error: unknown) => { mock.restoreAll(); console.error(error); process.exitCode = 1; });
