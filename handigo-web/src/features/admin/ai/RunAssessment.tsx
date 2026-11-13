import { useEffect, useState } from "react";
import axios from "axios";
import { adminAI } from "./adminAI.api";
import { sourceTypes, sourceLabels, statusLabels, type Feature, type SourceType } from "./adminAI.types";

export function RunAssessment({ feature, enabled, disabled, onDone }: { feature: Feature; enabled: boolean; disabled: boolean; onDone(): void }) {
  const [sourceType, setSourceType] = useState<SourceType>(sourceTypes[feature][0]);
  const [sources, setSources] = useState<Array<{ id: string; label: string; status: string }>>([]);
  const [sourceId, setSourceId] = useState("");
  const [email, setEmail] = useState("");
  const [sourceQuery, setSourceQuery] = useState<{ email?: string }>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    void adminAI.sources(sourceType, sourceQuery.email).then(items => { if (active) setSources(items); }).catch(() => { if (active) setError("Không tải được danh sách tài nguyên. Vui lòng thử lại."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sourceType, sourceQuery]);
  const searchSources = (nextEmail?: string) => {
    setSourceId(""); setSources([]); setError(""); setMessage(""); setLoading(true);
    setSourceQuery({ email: nextEmail });
  };
  const run = async (preview: boolean) => {
    setError(""); setMessage(""); setBusy(true);
    try {
      await adminAI.run({ feature, sourceType, sourceId: sourceId.trim(), preview });
      setMessage(preview ? "Đã đưa phân tích thử vào hàng đợi." : "Đã đưa tài nguyên được chọn vào hàng đợi tự động. Kết quả đạt tiêu chí có thể được áp dụng.");
      onDone();
    } catch (failure) { setError(axios.isAxiosError(failure) ? failure.response?.data?.message || "Không thể tạo tác vụ AI." : "Vui lòng kiểm tra tài nguyên hoặc khoảng ngày."); }
    finally { setBusy(false); }
  };
  const cannotRun = busy || disabled || !sourceId;
  return <section className="space-y-5 rounded-2xl border border-outline-variant bg-surface p-5 sm:p-6">
    <div><h3 className="text-lg font-bold">Chạy thử trên một trường hợp</h3><p className="mt-2 text-sm leading-relaxed text-on-surface-variant">Chọn dữ liệu thực tế để AI phân tích theo tiêu chí đã lưu. Chạy thử chỉ tạo kết quả để xem, chưa áp dụng thay đổi.</p></div>
    {sourceTypes[feature].length > 1 && <label className="block text-sm font-semibold">Bạn muốn phân tích nội dung nào?<select className="mt-2 min-h-11 w-full rounded-xl border border-outline-variant bg-surface px-3 text-sm font-normal" value={sourceType} disabled={busy || disabled} onChange={event => { setSourceType(event.target.value as SourceType); setSourceId(""); setSources([]); setEmail(""); setSourceQuery({}); setLoading(true); setError(""); }}>{sourceTypes[feature].map(type => <option key={type} value={type}>{sourceLabels[type]}</option>)}</select></label>}

      {loading && <p role="status">Đang tải tài nguyên…</p>}
      <label className="block text-sm font-semibold">Chọn trong 50 trường hợp gần nhất<select className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-outline-variant bg-surface px-3 text-sm font-normal" value={sources.some(item => item.id === sourceId) ? sourceId : ""} disabled={busy || disabled || loading} onChange={event => setSourceId(event.target.value)}><option value="">Chọn {sourceLabels[sourceType].toLocaleLowerCase("vi-VN")}…</option>{sources.map(item => <option key={item.id} value={item.id}>{item.label} · {statusLabels[item.status] || item.status}</option>)}</select></label>
      {sourceType === "provider_application" && sourceQuery.email && !loading && <p role="status" className="text-sm text-on-surface-variant">{sources.length ? `Tìm thấy ${sources.length} hồ sơ chờ duyệt của ${sourceQuery.email}. Chọn hồ sơ trong danh sách bên trên.` : "Không tìm thấy hồ sơ chờ duyệt với email này."}</p>}
      {!loading && !sources.length && !sourceQuery.email && <p className="rounded-xl bg-surface-container-low p-3 text-sm">{sourceType === "provider_application" ? "Chưa có hồ sơ chờ duyệt. Bạn có thể tìm bằng email người đăng ký." : "Chưa có dữ liệu trong danh sách này. Bạn có thể nhập mã cụ thể bên dưới."}</p>}
      {sourceType === "provider_application" && <details><summary className="cursor-pointer text-sm text-on-surface-variant">Tìm hồ sơ bằng email</summary><form className="mt-3 space-y-3" onSubmit={event => { event.preventDefault(); if (!busy && !disabled) searchSources(email.trim()); }}>
        <label className="block text-sm font-semibold">Email người đăng ký hồ sơ<input type="email" name="applicantEmail" autoComplete="off" required maxLength={254} placeholder="Ví dụ: tho@example.com" className="mt-2 min-h-11 w-full rounded-xl border border-outline-variant bg-surface px-3 text-sm font-normal" value={email} onChange={event => setEmail(event.target.value)} disabled={busy || disabled} /></label>
        <div className="flex flex-wrap gap-2"><button type="submit" disabled={busy || disabled || loading || !email.trim()} className="min-h-11 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">{loading ? "Đang tải…" : "Tìm hồ sơ"}</button>{sourceQuery.email && <button type="button" disabled={busy || disabled || loading} className="min-h-11 rounded-xl px-4 py-2 text-sm font-semibold text-primary hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50" onClick={() => { setEmail(""); searchSources(); }}>Xóa tìm kiếm</button>}</div>
      </form></details>}
      {sourceType !== "provider_application" && <details><summary className="cursor-pointer text-sm text-on-surface-variant">Tìm trường hợp khác bằng mã</summary><label className="mt-3 block text-sm">Mã trường hợp<input className="mt-2 min-h-11 w-full rounded-xl border border-outline-variant bg-surface px-3 text-sm" value={sourceId} onChange={event => setSourceId(event.target.value)} disabled={busy || disabled} /></label></details>}
    <button type="button" disabled={cannotRun} onClick={() => void run(true)} className="min-h-11 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50">{busy ? "Đang tạo tác vụ…" : "Phân tích thử"}</button>
    {error && <p role="alert" className="text-sm text-error">{error}</p>}{message && <p role="status" className="rounded-xl bg-primary/10 p-3 text-sm">{message} Mở mục Kết quả để theo dõi tiến trình.</p>}
    <details className="border-t border-outline-variant pt-4"><summary className="cursor-pointer text-sm font-semibold">Xử lý thật trường hợp đã chọn</summary><p className="my-3 text-sm leading-relaxed text-on-surface-variant">Thao tác này có thể cập nhật dữ liệu theo tiêu chí đang áp dụng. Chỉ khả dụng khi bạn đã bật tự động hóa trong modal này.</p><button type="button" disabled={!enabled || cannotRun} onClick={() => void run(false)} className="min-h-11 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Cho AI xử lý thật trường hợp này</button></details>
  </section>;
}
