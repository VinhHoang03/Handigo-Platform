import { EvidenceContent } from "./EvidenceContent";
import { readableText, sourceLabel } from "./assessmentPresentation";
import type { ReactNode } from "react";
import { ReportReviewForm } from "../components/cases/ReportReviewForm";
import { priorityLabels, statusLabels, type Assessment } from "./adminAI.types";

const categoryLabels = { payment: "Ghi nhận thanh toán", refund: "Hoàn tiền", service_quality: "Chất lượng dịch vụ", pricing: "Giá và thu thêm", schedule: "Lịch hẹn", conduct: "Hành vi và nội dung", safety: "Gian lận và an toàn", technical: "Lỗi hệ thống", other: "Cần làm rõ" };
const ownerLabels = { reporter: "Người gửi", provider: "Thợ", system: "Hệ thống", admin: "Admin" };
export function ComplaintWorkflowResult({ item, active = true, onUpdated, extraDetails, showDecisionForm = true }: { item: Assessment; active?: boolean; onUpdated?(): void; extraDetails?: ReactNode; showDecisionForm?: boolean }) {
  const resolution = item.output?.complaintResolution;
  const workflow = resolution?.workflow;
  if (!resolution || !workflow) return null;
  return <section className="min-w-0 space-y-4 text-sm leading-relaxed" aria-label="Phương án nghiệp vụ khiếu nại">
    <div><h4 className="font-semibold">Việc cần làm</h4><ol className="mt-2 list-inside list-decimal space-y-2">{workflow.tasks.map((task, index) => <li key={index}>{readableText(task.instruction)} <span className="text-on-surface-variant">({ownerLabels[task.owner]})</span></li>)}</ol></div>
    {item.adminDecision && <p role="status" className="rounded-lg bg-primary/10 p-3 text-primary">{`Admin đã áp dụng: ${statusLabels[item.adminDecision.status]}. ${item.adminDecision.note}`}</p>}
    {item.sourceType !== "report" && <p className="text-on-surface-variant">Hồ sơ khiếu nại cũ chỉ được phân tích tham khảo; xử lý trên báo cáo đã chuyển đổi trong danh sách hồ sơ.</p>}
    {showDecisionForm && !item.preview && item.sourceType === "report" && !item.adminDecision && active && ["manual", "completed"].includes(item.status)
      && <ReportReviewForm reportId={item.sourceId} assessment={item} onUpdated={onUpdated} />}
    <details><summary className="min-h-11 cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-primary">Xem chi tiết</summary><div className="mt-3 space-y-4">
    <h3 className="font-bold">{categoryLabels[workflow.category]} · {priorityLabels[resolution.severity] || "Chưa xác định mức độ"}</h3>
    <p>{readableText(resolution.severityReason)}</p>
    <div><h4 className="font-semibold">Lời phản ánh chưa xác minh</h4>{workflow.allegations.map((text, index) => <p key={index} className="mt-1 whitespace-pre-wrap">{readableText(text)}</p>)}</div>
    <div><h4 className="font-semibold">Dữ kiện đối chiếu từ hệ thống</h4>{!workflow.facts.length && <p className="mt-1 text-on-surface-variant">Chưa có dữ kiện hệ thống đủ để xác minh.</p>}{workflow.facts.map((fact, index) => <div key={index} className="mt-2 rounded-lg bg-surface-container-low p-3"><p>{readableText(fact.statement)}</p><p className="mt-1 break-all text-xs text-on-surface-variant">Nguồn: {[...new Set(fact.sourceIds.map(sourceLabel))].join(", ")}</p></div>)}</div>
    {resolution.disputed && <p className="font-semibold text-error">Các bên đang tranh chấp; cần Admin xác minh và quyết định.</p>}
    {!!workflow.missingEvidence.length && <div><h4 className="font-semibold">Thông tin cần bổ sung</h4><ul className="mt-2 list-inside list-disc space-y-2">{workflow.missingEvidence.map((entry, index) => <li key={index}><strong>{ownerLabels[entry.owner]}:</strong> {readableText(entry.description)}</li>)}</ul></div>}
    <div><h4 className="font-semibold">Công việc và điều kiện hoàn tất</h4><ol className="mt-2 space-y-3">{workflow.tasks.map((task, index) => <li key={index} className="space-y-1 rounded-lg bg-surface-container-low p-3"><p className="font-semibold">{index + 1}. {readableText(task.instruction)}</p><p>Phụ trách: {ownerLabels[task.owner]}</p><p className="text-on-surface-variant">Hoàn tất khi: {readableText(task.completionCondition)}</p></li>)}</ol></div>
    <div><h4 className="font-semibold">Đề xuất: {statusLabels[workflow.proposedStatus] || workflow.proposedStatus}</h4><p className="mt-1 whitespace-pre-wrap">{readableText(resolution.recommendation)}</p></div>
    {!!resolution.policyFindings.length && <details><summary className="min-h-11 cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-primary">Căn cứ chính sách</summary>{resolution.policyFindings.map((finding, index) => <blockquote key={index} className="mt-2 rounded-lg bg-surface-container-low p-3"><p>{readableText(finding.assessment)}</p><EvidenceContent quote={finding.quote} /><p className="mt-1 text-xs">Nguồn: {sourceLabel(finding.sourceId)}</p></blockquote>)}</details>}
    {!!resolution.escalationReasons.length && <details><summary className="min-h-11 cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-primary">Giới hạn và lý do cần Admin</summary>{resolution.escalationReasons.map((reason, index) => <p key={index} className="mt-1">{readableText(reason)}</p>)}</details>}
    {resolution.resolutionNote && <div><h4 className="font-semibold">Dự thảo kết luận · Chưa áp dụng</h4><p className="mt-1 whitespace-pre-wrap">{readableText(resolution.resolutionNote)}</p></div>}
      {extraDetails}
    </div></details>
  </section>;
}
