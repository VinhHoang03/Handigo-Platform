import type { CustomerMetricsSummary } from "./customer-metrics-summary";

const escape = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

// Báo cáo ngoại tuyến, không nhúng payload log, không gọi script/font/tài nguyên bên ngoài.
export function renderCustomerMetricsReport(report: ReturnType<CustomerMetricsSummary["report"]>) {
  const stages = report.stages.map((item) => `<tr><td>${escape(item.stage)}</td><td>${item.count}</td><td>${item.errors}</td><td>${escape(item.perTurn.p50Ms)}</td><td>${escape(item.perTurn.p95Ms)}</td></tr>`).join("");
  const usage = report.usage.map((item) => `<tr><td>${escape(item.provider)} / ${escape(item.model)}</td><td>${item.calls}</td><td>${item.inputTokens}</td><td>${item.outputTokens}</td><td>${item.estimatedUsd === null ? "Chưa có đơn giá" : escape(item.estimatedUsd.toFixed(6))}</td></tr>`).join("");
  const checks = [["Lượt FAILED", report.failed], ["Lỗi runtime", report.outcomes.error], ["Cần đối soát", report.requiresReconciliation],
    ["Lượt gián đoạn", report.interrupted], ["Mẫu vượt giới hạn", report.truncated],
    ["Lỗi từng bước", report.stages.reduce((sum, item) => sum + item.errors, 0)]] as const;
  return `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Báo cáo vận hành agent Handigo</title><style>body{font:16px system-ui;max-width:1100px;margin:40px auto;padding:0 20px;color:#172033;background:#f6f8fb}h1{font-size:28px}section{background:white;padding:24px;margin:20px 0;border-radius:12px;overflow:auto}table{border-collapse:collapse;width:100%;text-align:left}td,th{padding:12px;border-bottom:1px solid #ddd}li{margin:8px 0}.note{color:#526079;line-height:1.6}</style>
<h1>Báo cáo vận hành agent Handigo</h1><p class="note">Phiên bản ${escape(report.version)} · ${report.samples} lượt hợp lệ · ${report.ignored} dòng bỏ qua.</p>
<section><h2>Tổng quan</h2><p>p50: ${escape(report.latency.p50Ms)} ms · p95: ${escape(report.latency.p95Ms)} ms · cao nhất: ${escape(report.latency.maxMs)} ms</p>
<ul>${checks.map(([label, count]) => `<li>${escape(label)}: <strong>${count}</strong>${count ? " — cần xem xét" : ""}</li>`).join("")}</ul>
<p class="note">Đây là dấu hiệu cần kiểm tra, chưa phải ngưỡng SLA đã nghiệm thu. Gián đoạn hoặc đối soát không tự đồng nghĩa thao tác thất bại. Tệp không có dữ liệu không chứng minh hệ thống khỏe.</p></section>
<section><h2>Thời gian từng bước</h2><table><thead><tr><th>Bước</th><th>Số lần</th><th>Lỗi</th><th>p50/lượt (ms)</th><th>p95/lượt (ms)</th></tr></thead><tbody>${stages}</tbody></table><p class="note">Khoảng đo lồng nhau; không cộng trực tiếp thời gian các bước.</p></section>
<section><h2>Token và chi phí ước tính</h2><p>${report.turnsWithUsage}/${report.samples} lượt có metadata token.</p><table><thead><tr><th>Model</th><th>Lần có số liệu</th><th>Token vào</th><th>Token ra</th><th>Ước tính USD</th></tr></thead><tbody>${usage}</tbody></table>
<p class="note">Chỉ tính phản hồi có metadata và đơn giá do người vận hành cấp. Không phải hóa đơn; chưa gồm embedding, storage, thuế hoặc lời gọi lỗi không có usage. Thiếu metadata không có nghĩa miễn phí.</p></section></html>`;
}
