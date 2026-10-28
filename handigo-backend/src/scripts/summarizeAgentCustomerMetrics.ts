import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { readFile, writeFile } from "node:fs/promises";
import { CustomerMetricsSummary, modelRatesSchema } from "../ai/runtime/customer-metrics-summary";
import { renderCustomerMetricsReport } from "../ai/runtime/customer-metrics-html";

async function run() {
  const args = process.argv.slice(2);
  const failOnAttention = args.includes("--fail-on-attention");
  const paths = args.filter((arg) => arg !== "--fail-on-attention");
  if (paths.length > 3 || paths.some((arg) => arg.startsWith("--"))) throw new Error("Dùng: đường dẫn log hoặc -, đường dẫn HTML tùy chọn, đường dẫn đơn giá JSON tùy chọn, --fail-on-attention tùy chọn.");
  const input = paths[0] && paths[0] !== "-" ? createReadStream(paths[0], { encoding: "utf8" }) : process.stdin;
  const reader = createInterface({ input, crlfDelay: Infinity });
  const summary = new CustomerMetricsSummary();
  for await (const line of reader) summary.addLine(line);
  const rates = paths[2] ? modelRatesSchema.parse(JSON.parse(await readFile(paths[2], "utf8"))) : [];
  const report = summary.report(rates);
  if (paths[1]) await writeFile(paths[1], renderCustomerMetricsReport(report), "utf8");
  console.log(JSON.stringify(report, null, 2));
  // Cho phép scheduler/CI phát hiện tình trạng cần kiểm tra, không tự gửi thông báo hoặc đặt SLA.
  if (failOnAttention && (report.samples === 0 || Object.values(report.attention).some(Boolean))) process.exitCode = 1;
}
void run().catch(() => { console.error("Chưa tổng hợp được log trợ lý. Kiểm tra tệp đầu vào và quyền đọc."); process.exitCode = 1; });
