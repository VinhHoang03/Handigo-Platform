import { checkCustomerReadiness } from "../ai/runtime/customer-readiness";
import { createCustomerGraphConnection } from "../ai/runtime/customer-graph-connection";
import { createGraphMongoClient } from "../ai/runtime/checkpoint";
import { llmResponseSchema } from "../ai/llm/llm.interface";
import { z } from "zod";

async function run() {
  if (process.argv.slice(2).some((arg) => arg !== "--model")) throw new Error("Chỉ hỗ trợ tùy chọn --model.");
  const report = await checkCustomerReadiness(process.env, {
    async storage(uri) {
      const storage = createCustomerGraphConnection(uri);
      try { await storage.open(); } finally { await storage.close(); }
    },
    async knowledge(uri, config) {
      const client = createGraphMongoClient(uri);
      try {
        await client.connect();
        const indexes = z.array(z.object({ name: z.string(), queryable: z.boolean().optional(),
          latestDefinition: z.record(z.string(), z.unknown()).optional() })).parse(
          await client.db().collection("ai_knowledge_chunks").listSearchIndexes().toArray());
        const vector = indexes.find((item) => item.name === config.vectorIndex), text = indexes.find((item) => item.name === config.textIndex);
        const fields = vector?.latestDefinition?.fields as Array<{ type?: string; path?: string; numDimensions?: number; similarity?: string }> | undefined;
        if (!vector?.queryable || !text?.queryable || !fields?.some((field) => field.type === "vector" && field.path === "embedding"
          && field.numDimensions === config.dimensions && field.similarity === "cosine")) throw new Error();
        const source = await client.db().collection("ai_knowledge_documents").findOne({ status: "active", scope: "CUSTOMER_PUBLIC",
          [`publications.${config.generation}`]: { $exists: true } }, { projection: { _id: 1 }, maxTimeMS: 5000 });
        if (!source) throw new Error();
      } finally { await client.close(); }
    },
    async model(config) {
      const response = llmResponseSchema.parse(await config.createProvider().generate({
        system: "Chỉ kiểm tra kết nối. Trả FINAL với message bằng tiếng Việt. Không gọi công cụ nghiệp vụ.",
        goal: "Trả lời đã kết nối.", conversation: [], tools: [], signal: AbortSignal.timeout(config.timeoutMs),
      }));
      if (!["MESSAGE", "FINAL"].includes(response.type)) throw new Error();
    },
  }, process.argv.includes("--model"));
  console.log(JSON.stringify(report, null, 2));
  if (!report.configured || process.argv.includes("--model") && !report.modelVerified) process.exitCode = 1;
}
void run().catch(() => { console.error("Chưa kiểm tra được điều kiện chạy agent. Chỉ cấp cấu hình qua môi trường tiến trình; không tự đọc .env."); process.exitCode = 1; });
