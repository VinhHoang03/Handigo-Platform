import { readableText } from "./assessmentPresentation";
import { useEffect, useId, useState } from "react";
import { Pagination } from "@/components/common/Pagination";
import { adminAI } from "./adminAI.api";
import { assessmentTitle, statusLabels, type Assessment, type Feature } from "./adminAI.types";
import { AssessmentResult } from "./AssessmentResult";

export function AutomaticReviewResults({ feature, onOpenSource }: { feature: Feature; onOpenSource?(): void }) {
  const [items, setItems] = useState<Assessment[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const statusId = useId();
  useEffect(() => {
    let active = true;
    const load = () => {
      void adminAI.list(feature, page, status).then(result => {
        if (active) { setItems(result.items); setPages(result.totalPages); setError(""); }
      }).catch(() => { if (active) setError("Không tải được kết quả. Vui lòng thử lại."); })
        .finally(() => { if (active) setLoading(false); });
    };
    load();
    const timer = window.setInterval(load, 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [feature, page, status, refresh]);

  return <section aria-label="Kết quả tự động hóa" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-on-surface-variant">Kết quả cập nhật mỗi 10 giây. Mở từng lượt để xem căn cứ và việc cần Admin xử lý.</p>
      <label htmlFor={statusId} className="sr-only">Trạng thái kết quả</label>
      <select id={statusId} value={status} className="min-h-11 rounded-xl border border-outline-variant bg-surface px-3 text-sm" onChange={event => { setStatus(event.target.value); setPage(1); setItems([]); setLoading(true); }}>
        <option value="">Tất cả trạng thái</option>
        {["queued", "running", "retry", "completed", "manual", "stale", "error"].map(key => <option key={key} value={key}>{statusLabels[key]}</option>)}
      </select>
    </div>
    {loading && <p role="status">Đang tải kết quả…</p>}
    {error && <div role="alert" className="text-sm text-error"><p>{error}</p><button type="button" className="min-h-11 font-semibold underline" onClick={() => { setLoading(true); setRefresh(value => value + 1); }}>Thử lại</button></div>}
    {!loading && !error && !items.length && <p className="rounded-xl border border-dashed border-outline-variant p-6 text-center text-sm text-on-surface-variant">Chưa có kết quả phù hợp. Bạn có thể chạy thử một trường hợp hoặc bật tự động hóa.</p>}
    {!loading && items.map(item => <details key={item._id} className="overflow-hidden rounded-xl border border-outline-variant">
      <summary className="cursor-pointer p-4 focus-visible:outline-2 focus-visible:outline-primary"><span className="text-sm font-semibold">{assessmentTitle(item)}</span><span className="ml-2 text-xs text-on-surface-variant">{item.preview ? "Chạy thử" : "Tự động"} · {new Date(item.createdAt).toLocaleString("vi-VN")}</span><span className="mt-2 block truncate text-sm text-on-surface-variant">{readableText(item.output?.summary || item.error || "Tác vụ đang được xử lý trong nền.")}</span></summary>
      <div className="border-t border-outline-variant p-2"><AssessmentResult item={item} onOpenSource={onOpenSource} /></div>
    </details>)}
    {!loading && !error && <Pagination page={page} totalPages={pages} onChange={value => { setPage(value); setItems([]); setLoading(true); }} />}
  </section>;
}
