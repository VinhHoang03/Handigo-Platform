import mongoose from "mongoose";
import { readFile, realpath } from "node:fs/promises";
import { extname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { loadKnowledgeConfig } from "../ai/knowledge/knowledge.config";
import { builtinKnowledgeSources } from "../ai/knowledge/ingestion/builtin-sources";
import { prepareKnowledgeSource } from "../ai/knowledge/ingestion/chunker";
import { KnowledgeRepository } from "../ai/knowledge/knowledge.repository";
import { createEmbeddingProvider } from "../ai/knowledge/embeddings/embedding-provider";
import { processKnowledgeJob } from "../ai/knowledge/ingestion/indexing-worker";
import { knowledgeIndexDefinitions, listKnowledgeIndexes, requireKnowledgeIndexes, retrieveAtlasKnowledge } from "../ai/knowledge/retrieval/atlas-retriever";
import { knowledgeEvaluationCases } from "../ai/knowledge/evaluation/knowledge-cases";
import { AiKnowledgeChunk, AiKnowledgeDocument, AiKnowledgeJob, AiKnowledgeVersion } from "../models/aiKnowledge.model";

class KnowledgeCommandError extends Error {}

// Chỉ dùng biến của tiến trình; không tự tải .env, không in URI/khóa API hoặc sửa collection nghiệp vụ.
async function run() {
  const command = process.argv[2];
  const argument = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const commands = ["indexes", "setup", "create-indexes", "enqueue-builtins", "enqueue-file", "worker", "status", "retry", "revoke", "evaluate"];
  if (!command || !commands.includes(command)) throw new KnowledgeCommandError("Dùng lệnh indexes, setup, create-indexes, enqueue-builtins, enqueue-file, worker, status, retry, revoke hoặc evaluate.");
  const config = loadKnowledgeConfig();
  const definitions = knowledgeIndexDefinitions(config);
  if (command === "indexes") {
    console.log(JSON.stringify({ collection: "ai_knowledge_chunks", generation: config.generation, definitions }, null, 2));
    return;
  }
  const uri = process.env.MONGO_URI;
  if (!uri) throw new KnowledgeCommandError("Tiến trình chưa được cấp MONGO_URI; chưa kết nối hoặc thay đổi database.");
  await mongoose.connect(uri, { autoCreate: false, autoIndex: false, serverSelectionTimeoutMS: 10000 });
  const repository = new KnowledgeRepository();
  if (command === "setup") {
    await repository.setup();
    console.log("Đã chuẩn bị bốn collection ai_knowledge_* và index thường; không thay đổi collection nghiệp vụ.");
  } else if (command === "create-indexes") {
    const existing = await AiKnowledgeChunk.collection.listSearchIndexes().toArray();
    for (const definition of definitions) {
      if (existing.some((index) => index.name === definition.name)) {
        console.log(`Giữ nguyên index đã có: ${definition.name}.`);
      } else {
        await AiKnowledgeChunk.collection.createSearchIndex(definition);
        console.log(`Đã yêu cầu tạo index: ${definition.name}.`);
      }
    }
  } else if (command === "enqueue-builtins" || command === "enqueue-file") {
    const approvedBy = argument("approved-by");
    if (!approvedBy) throw new KnowledgeCommandError("Cần --approved-by để ghi nhận người duyệt nguồn công khai; không nhập dữ liệu riêng của khách.");
    let sources: unknown[];
    if (command === "enqueue-builtins") {
      sources = builtinKnowledgeSources();
    } else {
      const file = argument("file");
      if (!file) throw new KnowledgeCommandError("Cần --file trỏ tới tệp JSON nguồn đã duyệt.");
      const path = await realpath(file);
      if (extname(path).toLowerCase() !== ".json") throw new KnowledgeCommandError("Bộ nhập chỉ đọc tệp JSON nguồn kiến thức.");
      const stat = await import("node:fs/promises").then((fs) => fs.stat(path));
      if (stat.size > 2000000) throw new KnowledgeCommandError("Tệp kiến thức vượt giới hạn 2 MB.");
      const input: unknown = JSON.parse((await readFile(path, "utf8")).replace(/^\uFEFF/, ""));
      sources = Array.isArray(input) ? input : [input];
    }
    if (!sources.length || sources.length > 200) throw new KnowledgeCommandError("Mỗi lần nhập cần từ 1 đến 200 nguồn.");
    // Validate toàn bộ trước khi bắt đầu ghi công việc.
    const prepared = sources.map((source) => prepareKnowledgeSource(source, config));
    for (const source of prepared) await repository.enqueue(source, config, approvedBy);
    console.log(`Đã xếp ${prepared.length} nguồn vào hàng đợi; chưa công bố nguồn chưa đủ vector/index.`);
  } else if (command === "worker") {
    await requireKnowledgeIndexes(config);
    const provider = createEmbeddingProvider(config);
    let stopping = false;
    process.once("SIGINT", () => { stopping = true; });
    process.once("SIGTERM", () => { stopping = true; });
    do {
      const outcome = await processKnowledgeJob(config, provider, repository);
      console.log(`Kết quả xử lý công việc kiến thức: ${outcome}.`);
      if (!process.argv.includes("--watch")) break;
      if (outcome === "idle" || outcome === "retry") await delay(3000);
    } while (!stopping);
  } else if (command === "evaluate") {
    const set = argument("set") || "tuning";
    if (!["tuning", "heldout"].includes(set)) throw new KnowledgeCommandError("Tập đánh giá phải là tuning hoặc heldout.");
    const provider = createEmbeddingProvider(config);
    let passed = 0;
    const timings: number[] = [];
    for (const test of knowledgeEvaluationCases.filter((item) => item.set === set)) {
      const start = Date.now();
      const articles = await retrieveAtlasKnowledge(test.query, undefined, config, provider, AbortSignal.timeout(30000));
      const durationMs = Date.now() - start;
      timings.push(durationMs);
      const correct = test.title === null ? articles.length === 0 : articles.some((article) => article.title === test.title);
      if (correct) passed++;
      console.log(JSON.stringify({ id: test.id, correct, durationMs, returnedTitles: articles.map((article) => article.title) }));
    }
    console.log(JSON.stringify({ set, passed, total: timings.length, generation: config.generation,
      model: config.model, dimensions: config.dimensions, minVectorScore: config.minVectorScore,
      maximumDurationMs: Math.max(...timings) }));
    if (passed !== timings.length) process.exitCode = 1;
  } else if (command === "retry" || command === "revoke") {
    const id = argument("id");
    if (!id || !/^[a-f0-9]{64}$/.test(id)) throw new KnowledgeCommandError("Cần --id là mã công việc hoặc nguồn kiến thức hợp lệ.");
    if (command === "retry") await repository.retry(id);
    else await repository.revoke(id);
    console.log(command === "retry" ? "Đã xử lý yêu cầu thử lại công việc kiến thức." : "Đã thu hồi nguồn kiến thức; giữ nguyên nội dung và vector cũ.");
  } else {
    console.log(JSON.stringify({ generation: config.generation, documents: await AiKnowledgeDocument.countDocuments(),
      versions: await AiKnowledgeVersion.countDocuments(), chunks: await AiKnowledgeChunk.countDocuments(),
      jobs: await AiKnowledgeJob.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      attention: await AiKnowledgeJob.find({ status: { $in: ["failed", "running", "pending"] } })
        .select("_id status attempts errorCode leaseUntil nextAttemptAt").limit(20).lean(),
      sources: await AiKnowledgeDocument.find().select("_id sourceKey status publications").limit(200).lean(),
      indexes: (await listKnowledgeIndexes()).map((index) => ({ name: index.name, status: index.status, queryable: index.queryable })) }, null, 2));
  }
}
void run().catch((error: unknown) => {
  // Lỗi driver/provider có thể chứa URI hoặc văn bản; không xuất lỗi thô.
  console.error(error instanceof KnowledgeCommandError ? error.message
    : "Chưa hoàn tất lệnh kho kiến thức. Kiểm tra cấu hình tiến trình, quyền database, nguồn đầu vào và trạng thái index; dữ liệu hiện có được giữ nguyên.");
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
