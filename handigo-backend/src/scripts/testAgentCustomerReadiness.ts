import assert from "node:assert/strict";
import { checkCustomerReadiness, type CustomerReadinessDependencies } from "../ai/runtime/customer-readiness";

async function run() {
  let storage = 0, knowledge = 0, model = 0;
  const deps: CustomerReadinessDependencies = {
    storage: async () => { storage++; }, knowledge: async () => { knowledge++; }, model: async () => { model++; },
  };
  const empty = await checkCustomerReadiness({}, deps);
  assert.equal(empty.configured, false);
  assert.equal(storage + knowledge + model, 0);
  const env = { MONGO_URI: "mongodb://fixture-private-uri", GEMINI_API_KEY: "fixture-private-key", AI_AGENT_PROVIDER: "gemini",
    AI_AGENT_MODEL: "gemini-3.5-flash-lite", AI_AGENT_CUSTOMER_ROLLOUT: "all", AI_KNOWLEDGE_ENABLED: "true" };
  const ready = await checkCustomerReadiness(env, deps, true);
  assert.equal(ready.configured, true); assert.equal(ready.modelVerified, true);
  assert.equal(storage, 1); assert.equal(knowledge, 1); assert.equal(model, 1);
  const noProbe = await checkCustomerReadiness(env, deps);
  assert.equal(noProbe.modelVerified, false); assert.equal(model, 1);
  const off = await checkCustomerReadiness({ ...env, AI_AGENT_CUSTOMER_ROLLOUT: "off" }, deps);
  assert.equal(off.configured, false);
  const broken = await checkCustomerReadiness(env, { ...deps, storage: async () => { throw new Error("fixture-private-uri fixture-private-key"); } });
  assert.equal(broken.configured, false);
  assert.ok(!JSON.stringify([ready, broken]).includes("fixture-private"));
  const badModel = await checkCustomerReadiness(env, { ...deps, model: async () => { throw new Error("Lỗi provider fixture."); } }, true);
  assert.equal(badModel.configured, false); assert.equal(badModel.modelVerified, false);
  console.log("Đạt kiểm tra điều kiện chạy: cấu hình/phạm vi/storage/RAG/model, không tự bật rollout, không lộ URI/key và không gọi model khi chưa yêu cầu.");
}
void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
