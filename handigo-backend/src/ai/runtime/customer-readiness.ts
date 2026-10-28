import { loadAgentConfig } from "../ai.config";
import { loadKnowledgeConfig } from "../knowledge/knowledge.config";
import { selectNewSessionEngine } from "./customer-rollout.config";

type Check = { name: string; status: "passed" | "failed" | "skipped"; message: string };
export interface CustomerReadinessDependencies {
  storage(uri: string): Promise<void>;
  knowledge(uri: string, config: ReturnType<typeof loadKnowledgeConfig>): Promise<void>;
  model(config: ReturnType<typeof loadAgentConfig>): Promise<void>;
}

// Chỉ trả metadata cố định; không đưa env, URI, key hoặc lỗi driver/provider gốc vào báo cáo.
export async function checkCustomerReadiness(env: NodeJS.ProcessEnv, deps: CustomerReadinessDependencies, probeModel = false) {
  const checks: Check[] = [];
  const check = async (name: string, run: () => Promise<void> | void, passed: string, failed: string) => {
    try { await run(); checks.push({ name, status: "passed", message: passed }); }
    catch { checks.push({ name, status: "failed", message: failed }); }
  };
  let config: ReturnType<typeof loadAgentConfig> | undefined;
  await check("model_config", () => { config = loadAgentConfig(env); }, "Cấu hình model hợp lệ.", "Thiếu hoặc sai cấu hình provider/model/key.");
  await check("customer_rollout", () => {
    const id = env.AI_AGENT_CUSTOMER_PILOT_USERS?.split(",")[0]?.trim() || "f".repeat(24);
    if (selectNewSessionEngine({ id, role: "CUSTOMER" }, env) !== "langgraph-customer") throw new Error();
  }, "Đã chọn engine nghiệp vụ cho phạm vi phát hành.", "Engine nghiệp vụ chưa bật hoặc cấu hình phạm vi không hợp lệ.");
  const uri = env.MONGO_URI?.trim();
  await check("graph_storage", async () => { if (!uri) throw new Error(); await deps.storage(uri); },
    "Collection/index checkpoint và ledger sẵn sàng.", "Chưa có MONGO_URI hoặc kho checkpoint/ledger chưa sẵn sàng.");
  if (env.AI_KNOWLEDGE_ENABLED === "true") await check("knowledge_indexes", async () => {
    if (!uri) throw new Error();
    const knowledge = loadKnowledgeConfig(env);
    const key = knowledge.provider === "gemini" ? env.GEMINI_API_KEY : env.OPENAI_API_KEY;
    if (!key) throw new Error();
    await deps.knowledge(uri, knowledge);
  }, "Index và nguồn kiến thức đã công bố sẵn sàng.", "Kho kiến thức/index/embedding key chưa sẵn sàng.");
  else checks.push({ name: "knowledge_indexes", status: "skipped", message: "RAG Atlas chưa bật; hiện dùng nguồn tích hợp sẵn." });
  if (probeModel && config) await check("model_probe", () => deps.model(config!),
    "Model phản hồi đúng cấu trúc.", "Model chưa phản hồi hợp lệ; kiểm tra quyền, quota hoặc kết nối.");
  else checks.push({ name: "model_probe", status: "skipped", message: "Chưa gọi model thật; dùng --model khi muốn kiểm chứng kết nối." });
  return { configured: checks.every((item) => item.status !== "failed"),
    modelVerified: checks.some((item) => item.name === "model_probe" && item.status === "passed"), checks,
    limitations: "Không thay E2E tài khoản thật, kiểm chứng ghi nghiệp vụ hoặc kiểm tra tải. Chương trình không bật rollout hay sửa .env." };
}
