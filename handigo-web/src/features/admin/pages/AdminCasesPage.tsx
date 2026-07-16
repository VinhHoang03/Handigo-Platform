import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, FileWarning, Flag, Gavel, RefreshCw } from "lucide-react";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { Modal } from "@/components/common/Modal";
import { Pagination } from "@/components/common/Pagination";
import type {
  CaseListQuery,
  Complaint,
  ComplaintStatus,
  Report,
  ReportStatus,
  Violation,
  ViolationSourceType,
} from "@/features/case-management/types/caseManagement.types";
import { getErrorMessage } from "@/utils/apiError";
import { adminCasesApi, type ViolationQuery } from "../api/adminCases.api";
import { ViolationFormModal } from "../components/cases/ViolationFormModal";

type AdminCaseTab = "complaints" | "reports" | "violations";
type SelectedAdminCase =
  | { kind: "complaint"; item: Complaint }
  | { kind: "report"; item: Report }
  | { kind: "violation"; item: Violation };

const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });

const TABS = [
  { value: "complaints" as const, label: "Khiếu nại", icon: FileWarning },
  { value: "reports" as const, label: "Báo cáo", icon: Flag },
  { value: "violations" as const, label: "Vi phạm", icon: Gavel },
];

const STATUS_LABELS: Record<string, string> = {
  pending: "Chờ xử lý",
  evidence_requested: "Chờ bổ sung bằng chứng",
  under_review: "Đang xem xét",
  resolved: "Đã xử lý",
  rejected: "Đã từ chối",
  cancelled: "Đã hủy",
  confirmed: "Đã xác nhận",
  active: "Đang áp dụng",
};

const STATUS_OPTIONS: Record<AdminCaseTab, string[]> = {
  complaints: ["pending", "evidence_requested", "under_review", "resolved", "rejected", "cancelled"],
  reports: ["pending", "under_review", "confirmed", "rejected", "resolved"],
  violations: ["active", "resolved"],
};

function EvidenceLinks({ urls }: { urls: string[] }) {
  if (!urls.length) return <p className="text-sm text-on-surface-variant">Chưa có bằng chứng.</p>;
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{urls.map((url, index) => <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-outline-variant"><img src={url} alt={`Bằng chứng ${index + 1}`} className="h-36 w-full object-cover" /><p className="p-2 text-xs font-semibold text-primary">Mở ảnh gốc</p></a>)}</div>;
}

interface SourceForViolation {
  sourceType: ViolationSourceType;
  sourceId: string;
  userId?: string;
  orderId?: string;
}

export default function AdminCasesPage() {
  const [tab, setTab] = useState<AdminCaseTab>("complaints");
  const [query, setQuery] = useState<CaseListQuery>({ page: 1, limit: 10 });
  const [items, setItems] = useState<Array<Complaint | Report | Violation>>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<SelectedAdminCase | null>(null);
  const [violationSource, setViolationSource] = useState<SourceForViolation | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [nextStatus, setNextStatus] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = tab === "complaints"
        ? await adminCasesApi.complaints(query)
        : tab === "reports"
          ? await adminCasesApi.reports(query)
          : await adminCasesApi.violations(query as ViolationQuery);
      setItems(result.items);
      setTotalPages(result.pagination.totalPages || 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Không thể tải hàng đợi xử lý."));
    } finally {
      setLoading(false);
    }
  }, [query, tab]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const switchTab = (nextTab: AdminCaseTab) => {
    setTab(nextTab);
    setQuery({ page: 1, limit: 10 });
    setItems([]);
    setSelected(null);
  };

  const openDetail = async (id: string) => {
    try {
      setDetailLoading(true);
      setActionError("");
      setEvidenceNote("");
      setNextStatus("");
      setReviewNote("");
      setResolutionNote("");
      if (tab === "complaints") {
        setSelected({ kind: "complaint", item: await adminCasesApi.complaint(id) });
      } else if (tab === "reports") {
        setSelected({ kind: "report", item: await adminCasesApi.report(id) });
      } else {
        setSelected({ kind: "violation", item: await adminCasesApi.violation(id) });
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Không thể tải chi tiết hồ sơ."));
    } finally {
      setDetailLoading(false);
    }
  };

  const runComplaintAction = async (action: () => Promise<Complaint>) => {
    try {
      setBusy(true);
      setActionError("");
      const item = await action();
      setSelected({ kind: "complaint", item });
      setEvidenceNote("");
      setNextStatus("");
      setResolutionNote("");
      await load();
    } catch (requestError) {
      setActionError(getErrorMessage(requestError, "Không thể cập nhật khiếu nại."));
    } finally {
      setBusy(false);
    }
  };

  const runReportAction = async () => {
    if (!selected || selected.kind !== "report" || !nextStatus) return;
    try {
      setBusy(true);
      setActionError("");
      const item = await adminCasesApi.reviewReport(
        selected.item._id,
        nextStatus as ReportStatus,
        reviewNote.trim() || undefined,
        resolutionNote.trim() || undefined,
      );
      setSelected({ kind: "report", item });
      setNextStatus("");
      setReviewNote("");
      setResolutionNote("");
      await load();
    } catch (requestError) {
      setActionError(getErrorMessage(requestError, "Không thể cập nhật báo cáo."));
    } finally {
      setBusy(false);
    }
  };

  const openViolationForm = () => {
    if (!selected || selected.kind === "violation") return;
    if (selected.kind === "complaint") {
      setViolationSource({
        sourceType: "COMPLAINT",
        sourceId: selected.item._id,
        userId: selected.item.targetUserId._id,
        orderId: selected.item.orderId._id,
      });
    } else {
      setViolationSource({
        sourceType: "REPORT",
        sourceId: selected.item._id,
        userId: selected.item.targetUserId?._id,
        orderId: selected.item.orderId?._id,
      });
    }
  };

  const selectedTitle = selected?.kind === "complaint"
    ? selected.item.title
    : selected?.kind === "report"
      ? selected.item.title
      : selected?.item.violationType;

  const detailEvidence = useMemo(() => {
    if (!selected) return [];
    if (selected.kind === "complaint") {
      return [
        ...selected.item.evidenceImages,
        ...(selected.item.evidence?.map((evidence) => evidence.url) || []),
      ];
    }
    if (selected.kind === "report") {
      return [
        ...selected.item.evidenceImages,
        ...selected.item.evidenceFiles.map((file) => file.url),
      ];
    }
    return [];
  }, [selected]);

  return (
    <DashboardShell role="ADMIN">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><h1 className="text-headline-lg font-bold">Khiếu nại, báo cáo và vi phạm</h1><p className="mt-2 text-on-surface-variant">Kiểm tra bằng chứng, ra quyết định xử lý và áp dụng hình phạt từ nguồn đã xác minh.</p></div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2.5 font-semibold text-primary disabled:opacity-40"><RefreshCw size={18} className={loading ? "animate-spin" : ""} /> Làm mới</button>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {TABS.map((item) => { const Icon = item.icon; const active = tab === item.value; return <button key={item.value} type="button" onClick={() => switchTab(item.value)} className={`flex items-center gap-3 rounded-2xl border p-4 text-left ${active ? "border-primary bg-primary/5 text-primary" : "border-outline-variant/40 bg-surface"}`}><Icon size={20} /><span className="font-bold">{item.label}</span></button>; })}
      </section>

      <section className="rounded-2xl border border-outline-variant/40 bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={query.keyword || ""} onChange={(event) => setQuery((current) => ({ ...current, page: 1, keyword: event.target.value || undefined }))} maxLength={100} placeholder="Tìm theo tiêu đề hoặc nội dung..." disabled={tab === "violations"} className="min-h-11 rounded-xl border border-outline-variant px-3 disabled:bg-surface-container" />
          <select value={query.status || ""} onChange={(event) => setQuery((current) => ({ ...current, page: 1, status: event.target.value || undefined }))} className="min-h-11 rounded-xl border border-outline-variant bg-surface px-3"><option value="">Tất cả trạng thái</option>{STATUS_OPTIONS[tab].map((status) => <option key={status} value={status}>{STATUS_LABELS[status] || status}</option>)}</select>
        </div>
      </section>

      <AsyncState loading={loading} error={error} empty={!items.length} emptyMessage="Không có hồ sơ phù hợp." onRetry={load}>
        <div className="overflow-x-auto rounded-2xl border border-outline-variant/40 bg-surface">
          <table className="w-full min-w-[900px] text-left"><thead className="bg-surface-container-low text-sm"><tr><th className="p-4">Hồ sơ</th><th className="p-4">Nguồn / đối tượng</th><th className="p-4">Trạng thái</th><th className="p-4">Ngày tạo</th><th className="p-4 text-right">Thao tác</th></tr></thead><tbody>{items.map((item) => { const isViolation = "violationType" in item; const title = isViolation ? item.violationType : item.title; const source = isViolation ? item.sourceType : "complainantId" in item ? item.complainantId.fullName : item.reporterId.fullName; return <tr key={item._id} className="border-t border-outline-variant/30"><td className="p-4"><p className="max-w-md truncate font-bold">{title}</p><p className="mt-1 text-xs text-on-surface-variant">#{item._id.slice(-8).toUpperCase()}</p></td><td className="p-4 text-sm">{source}</td><td className="p-4"><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{STATUS_LABELS[item.status] || item.status}</span></td><td className="p-4 text-sm">{dateTime.format(new Date(item.createdAt))}</td><td className="p-4 text-right"><button type="button" onClick={() => void openDetail(item._id)} title="Xem chi tiết" className="inline-grid h-10 w-10 place-items-center rounded-xl border border-outline-variant text-primary"><Eye size={18} /></button></td></tr>; })}</tbody></table>
        </div>
      </AsyncState>
      <Pagination page={query.page || 1} totalPages={totalPages} onChange={(page) => setQuery((current) => ({ ...current, page }))} />

      <Modal open={Boolean(selected) || detailLoading} title={selectedTitle || "Chi tiết hồ sơ"} onClose={() => { setSelected(null); setActionError(""); }} size="xl" closeOnOverlayClick={!busy}>
        {detailLoading && !selected ? <div className="p-10 text-center text-on-surface-variant">Đang tải chi tiết...</div> : selected ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
            <div className="space-y-5">
              <section className="rounded-2xl bg-surface-container-low p-5"><div className="flex flex-wrap gap-2 text-xs text-on-surface-variant"><span className="rounded-full bg-primary/10 px-3 py-1 font-bold text-primary">{STATUS_LABELS[selected.item.status] || selected.item.status}</span><span>#{selected.item._id.slice(-8).toUpperCase()}</span><span>{dateTime.format(new Date(selected.item.createdAt))}</span></div>{selected.kind !== "violation" && <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{selected.item.description}</p>}{selected.kind === "violation" && <><p className="mt-4 text-sm"><b>Người vi phạm:</b> {selected.item.userId.fullName} · {selected.item.userId.email}</p><p className="mt-3 whitespace-pre-wrap text-sm"><b>Lý do:</b> {selected.item.reason}</p><p className="mt-3 whitespace-pre-wrap text-sm"><b>Quyết định:</b> {selected.item.adminDecision}</p></>}</section>
              {selected.kind !== "violation" && <section><h3 className="mb-3 font-bold">Bằng chứng</h3><EvidenceLinks urls={detailEvidence} /></section>}
              {selected.kind === "complaint" && selected.item.requestedEvidenceNote && <section className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800"><b>Nội dung yêu cầu bổ sung:</b><p className="mt-2">{selected.item.requestedEvidenceNote}</p></section>}
              {selected.kind !== "violation" && selected.item.resolutionNote && <section className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"><b>Kết quả xử lý:</b><p className="mt-2 whitespace-pre-wrap">{selected.item.resolutionNote}</p></section>}
            </div>

            <aside className="space-y-5">
              {selected.kind === "complaint" && !['resolved', 'rejected', 'cancelled'].includes(selected.item.status) && <><section className="rounded-2xl border border-outline-variant p-4"><h3 className="font-bold">Yêu cầu bổ sung bằng chứng</h3><textarea value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} minLength={5} maxLength={3000} rows={4} className="mt-3 w-full rounded-xl border border-outline-variant p-3" /><button type="button" onClick={() => void runComplaintAction(() => adminCasesApi.requestComplaintEvidence(selected.item._id, evidenceNote.trim()))} disabled={busy || evidenceNote.trim().length < 5} className="btn-primary mt-3 w-full">Gửi yêu cầu</button></section><section className="rounded-2xl border border-outline-variant p-4"><h3 className="font-bold">Cập nhật kết quả</h3><select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} className="mt-3 min-h-11 w-full rounded-xl border border-outline-variant px-3"><option value="">Chọn trạng thái</option><option value="under_review">Đang xem xét</option><option value="resolved">Đã xử lý</option><option value="rejected">Từ chối</option></select><textarea value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} maxLength={3000} rows={4} placeholder="Kết luận xử lý..." className="mt-3 w-full rounded-xl border border-outline-variant p-3" /><button type="button" onClick={() => void runComplaintAction(() => adminCasesApi.updateComplaint(selected.item._id, nextStatus as ComplaintStatus, resolutionNote.trim() || undefined))} disabled={busy || !nextStatus} className="btn-primary mt-3 w-full">Cập nhật</button></section></>}
              {selected.kind === "report" && !selected.item.createdViolationId && <section className="rounded-2xl border border-outline-variant p-4"><h3 className="font-bold">Review báo cáo</h3><select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} className="mt-3 min-h-11 w-full rounded-xl border border-outline-variant px-3"><option value="">Chọn trạng thái</option><option value="under_review">Đang xem xét</option><option value="confirmed">Xác nhận</option><option value="rejected">Từ chối</option><option value="resolved">Đã xử lý</option></select><textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} maxLength={3000} rows={3} placeholder="Ghi chú review..." className="mt-3 w-full rounded-xl border border-outline-variant p-3" /><textarea value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} maxLength={3000} rows={3} placeholder="Kết luận xử lý..." className="mt-3 w-full rounded-xl border border-outline-variant p-3" /><button type="button" onClick={() => void runReportAction()} disabled={busy || !nextStatus} className="btn-primary mt-3 w-full">Cập nhật</button></section>}
              {selected.kind !== "violation" && !selected.item.createdViolationId && <button type="button" onClick={openViolationForm} className="w-full rounded-xl bg-error px-4 py-3 font-bold text-white">Tạo vi phạm và áp dụng penalty</button>}
              {selected.kind !== "violation" && selected.item.createdViolationId && <p className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Hồ sơ đã tạo bản ghi vi phạm.</p>}
              {selected.kind === "violation" && <section className="rounded-2xl border border-outline-variant p-4 text-sm"><p><b>Mức độ:</b> {selected.item.severity}</p><p className="mt-2"><b>Hình phạt:</b> {selected.item.penaltyType}</p>{selected.item.penalty?.durationDays && <p className="mt-2"><b>Thời hạn:</b> {selected.item.penalty.durationDays} ngày</p>}{selected.item.endAt && <p className="mt-2"><b>Kết thúc:</b> {dateTime.format(new Date(selected.item.endAt))}</p>}</section>}
              {actionError && <p className="rounded-xl bg-error/10 p-3 text-sm font-semibold text-error">{actionError}</p>}
            </aside>
          </div>
        ) : null}
      </Modal>

      {violationSource && <ViolationFormModal open {...violationSource} onClose={() => setViolationSource(null)} onCreated={() => { setSelected(null); void load(); }} />}
    </DashboardShell>
  );
}
