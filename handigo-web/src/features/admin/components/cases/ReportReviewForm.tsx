import { useId, useState } from "react";
import { adminCasesApi } from "../../api/adminCases.api";
import { adminAI } from "../../ai/adminAI.api";
import { statusLabels, type Assessment, type ComplaintDecision } from "../../ai/adminAI.types";
import { readableText } from "../../ai/assessmentPresentation";
import { getErrorMessage } from "@/utils/apiError";

const fieldClass = "w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm leading-5 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60";

export function ReportReviewForm({ reportId, assessment, customerNoShow = false, busy = false, onBusyChange, onUpdated }: {
  reportId: string; assessment?: Assessment | null; customerNoShow?: boolean; busy?: boolean;
  onBusyChange?(busy: boolean): void; onUpdated?(): void | Promise<void>;
}) {
  const [statusInput, setStatus] = useState<ComplaintDecision["status"] | "" | null>(null);
  const [noteInput, setNote] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const decisionId = useId();
  const ai = !customerNoShow && assessment?.sourceId === reportId && !assessment.preview && !assessment.adminDecision
    && assessment.sourceType === "report" && ["manual", "completed"].includes(assessment.status)
    && assessment.output?.complaintResolution?.workflow ? assessment : null;
  const resolution = ai?.output?.complaintResolution;
  const workflow = resolution?.workflow;
  const suggestion = ai && ai._id !== submittedId ? resolution : null;
  const status = statusInput ?? suggestion?.workflow?.proposedStatus ?? "";
  const reporterEvidence = suggestion?.workflow?.missingEvidence.filter(entry => entry.owner === "reporter") || [];
  const suggestedNote = status === "evidence_requested"
    ? reporterEvidence.length ? `Vui lòng bổ sung:\n${reporterEvidence.map(entry => `• ${readableText(entry.description)}`).join("\n")}` : ""
    : ["confirmed", "rejected", "resolved"].includes(status) && suggestion?.resolutionNote?.trim()
      ? suggestion.resolutionNote : suggestion?.recommendation || "";
  const note = noteInput ?? readableText(suggestedNote).slice(0, 3000);
  const terminal = ["confirmed", "rejected", "resolved"].includes(status);
  const missing = Boolean(ai && (workflow?.missingEvidence.length || ai.output?.missingData.length || resolution?.evidenceStatus !== "sufficient"
    || (["confirmed", "rejected"].includes(status) && !workflow?.facts.length)));
  const completedTasks = workflow?.tasks.map((_, index) => ({ index, evidence: (completed[`${ai?._id}:${index}`] || "").trim() })) || [];
  const unfinished = status === "resolved" && completedTasks.some(task => task.evidence.length < 10);
  const minLength = ai ? 10 : status === "evidence_requested" ? 5 : 0;
  const disabled = busy || saving;
  const canSubmit = Boolean(status) && note.trim().length >= minLength && !(terminal && missing) && !unfinished;
  const submit = async () => {
    if (disabled || !canSubmit || !status) return;
    setSaving(true); onBusyChange?.(true); setError(""); setMessage("");
    try {
      if (ai) {
        await adminAI.decideComplaint(ai._id, { status, note: note.trim(), completedTasks: completedTasks.filter(task => task.evidence.length >= 10) });
      } else if (status === "evidence_requested") {
        await adminCasesApi.requestReportEvidence(reportId, note.trim());
      } else {
        await adminCasesApi.reviewReport(reportId, status, note.trim() || undefined, terminal ? note.trim() || undefined : undefined);
      }
      setSubmittedId(ai?._id || null); setStatus(null); setNote(null); setCompleted({}); setMessage("Đã cập nhật báo cáo.");
      await onUpdated?.();
    } catch (failure) { setError(getErrorMessage(failure, "Không thể cập nhật báo cáo. Vui lòng kiểm tra và thử lại.")); }
    finally { setSaving(false); onBusyChange?.(false); }
  };
  const statuses: ComplaintDecision["status"][] = customerNoShow ? ["under_review", "confirmed", "rejected"]
    : ["under_review", "evidence_requested", "confirmed", "rejected", "resolved"];
  return <form className="w-full min-w-0 max-w-[340px] space-y-3 rounded-xl border border-outline-variant/70 bg-surface-container-low/40 p-3" aria-label="Xử lý báo cáo" onSubmit={event => { event.preventDefault(); void submit(); }}>
    <h3 className="text-sm font-semibold">Xử lý báo cáo</h3>
      <div className="min-w-0"><label htmlFor={decisionId} className="sr-only">Trạng thái</label><select id={decisionId} className={`${fieldClass} min-h-11`} disabled={disabled} value={status} onChange={event => setStatus(event.target.value as typeof status)}>
        <option value="">Chọn trạng thái xử lý</option>{statuses.map(value => <option key={value} value={value}>{customerNoShow && value === "confirmed" ? "Chấp thuận và hỗ trợ 5.000đ" : statusLabels[value] || value}</option>)}
      </select></div>
    {status && <>
    <label className="block space-y-1.5 text-sm font-medium">{status === "evidence_requested" ? "Yêu cầu bổ sung" : "Ghi chú xử lý"}<textarea name="decisionNote" autoComplete="off" required={minLength > 0} minLength={minLength || undefined} maxLength={3000} rows={6} placeholder={status === "evidence_requested" ? "Nội dung cần người phản ánh bổ sung…" : "Nhập ghi chú hoặc kết quả xử lý…"} className={`${fieldClass} block min-h-36 resize-y font-normal`} disabled={disabled} value={note} onChange={event => setNote(event.target.value)} /></label>
    {status === "resolved" && workflow?.tasks.map((task, index) => <label key={`${ai?._id}:${index}`} className="block space-y-1.5 text-sm">Kết quả xác minh việc {index + 1}: {readableText(task.instruction)}<textarea name={`task-${index}`} autoComplete="off" required minLength={10} maxLength={1000} rows={2} className={`${fieldClass} block resize-y`} disabled={disabled} value={completed[`${ai?._id}:${index}`] || ""} onChange={event => setCompleted(previous => ({ ...previous, [`${ai?._id}:${index}`]: event.target.value }))} /></label>)}
    {terminal && missing && <p className="text-sm text-error">Còn thiếu bằng chứng. Bổ sung và phân tích lại trước khi xác nhận, từ chối hoặc kết thúc.</p>}
    <div className="flex justify-end"><button type="submit" disabled={disabled || !canSubmit} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Đang cập nhật…" : "Xác nhận xử lý"}</button></div>
    </>}
    {error && <p role="alert" className="text-sm text-error">{error}</p>}
    {message && <p role="status" className="text-sm text-primary">{message}</p>}
  </form>;
}
