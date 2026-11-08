import { ReportReviewForm } from "../components/cases/ReportReviewForm";
import { useEffect, useState } from "react";
import { adminAI } from "./adminAI.api";
import { assessmentTitle, type Assessment } from "./adminAI.types";
import { AssessmentResult } from "./AssessmentResult";
import { getErrorMessage } from "@/utils/apiError";

export function ComplaintReviewPanel({ reportId, active, onUpdated, reviewBusy, onReviewBusyChange, reviewable = active }: { reportId: string; active: boolean; onUpdated?(): void; reviewBusy?: boolean; onReviewBusyChange?(busy: boolean): void; reviewable?: boolean }) {
  const [item, setItem] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [autoEnabled, setAutoEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => {
      void adminAI.configs().then(result => {
        if (alive) setAutoEnabled(result.configs.find(config => config.feature === "complaint_summary")?.enabled ?? false);
      }).catch(() => { if (alive) setAutoEnabled(null); });
      void adminAI.list("complaint_summary", 1, undefined, reportId).then(result => {
      if (alive) { setItem(result.items[0] || null); setError(""); }
    }).catch(() => { if (alive) setError("Không thể tải phân tích. Hãy thử lại."); }).finally(() => { if (alive) setLoading(false); }); };
    load();
    const timer = window.setInterval(load, 10000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [reportId, revision]);
  const run = async () => {
    setBusy(true); setError("");
    try {
      const result = await adminAI.configs();
      const enabled = result.configs.find(config => config.feature === "complaint_summary")?.enabled;
      const job = await adminAI.run({ feature: "complaint_summary", sourceType: "report", sourceId: reportId, preview: !enabled });
      setItem(job); setRevision(value => value + 1);
    } catch (failure) { setError(getErrorMessage(failure, "Không thể phân tích khiếu nại. Hãy kiểm tra cấu hình tự động.")); }
    finally { setBusy(false); }
  };
  const waiting = item && ["queued", "running", "retry"].includes(item.status);
  return <section className={`grid items-start gap-5 ${reviewable ? "lg:grid-cols-[minmax(0,1fr)_320px]" : ""}`} aria-label="Hỗ trợ xử lý khiếu nại bằng AI">
    <div className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Phân tích và phương án xử lý</h3>
      {active && autoEnabled === false && <button type="button" disabled={busy || Boolean(waiting)} onClick={() => void run()} className="min-h-11 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-primary hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">{busy ? "Đang gửi…" : item ? "Phân tích lại" : "Phân tích thử"}</button>}
    </div>
    {loading && <p role="status">Đang tải phân tích…</p>}
    {error && <div role="alert" className="text-sm text-error"><p>{error}</p><button type="button" className="min-h-11 font-semibold underline" onClick={() => setRevision(value => value + 1)}>Tải lại phân tích</button></div>}
    {waiting && <p role="status" className="text-sm">{assessmentTitle(item)}</p>}
    {!loading && !error && !item && <p className="text-sm text-on-surface-variant">Chưa có phân tích cho khiếu nại này.</p>}
    {item && !waiting && <AssessmentResult key={item._id} item={item} embedded active={active} showDecisionForm={false} onUpdated={() => { setRevision(value => value + 1); onUpdated?.(); }} />}
    </div>
    {reviewable && <aside className="mx-auto w-full min-w-0 max-w-[340px] lg:sticky lg:top-0 lg:mx-0 lg:max-h-[calc(100dvh-220px)] lg:max-w-none lg:overflow-y-auto">
      <ReportReviewForm key={reportId} reportId={reportId} assessment={active ? item : null} busy={reviewBusy || loading} onBusyChange={onReviewBusyChange} onUpdated={() => { setRevision(value => value + 1); onUpdated?.(); }} />
    </aside>}
  </section>;
}
