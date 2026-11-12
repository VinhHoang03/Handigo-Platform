import { ReportReviewForm } from "./ReportReviewForm";
import { Modal } from "@/components/common/Modal";
import { caseDateTime } from "./case-table-columns";
import type { SelectedAdminCase } from "./case-detail.types";
import { CASE_STATUS_LABELS, PENALTY_LABELS, VIOLATION_SEVERITY_LABELS, getCaseStatusClasses } from "./case-status.constants";
import { NoShowReviewDetails } from "./NoShowReviewDetails";
import { NoShowVerificationSummary } from "./NoShowVerificationSummary";
import { getNoShowUserDescription } from "./no-show-review.utils";
import { ComplaintReviewPanel } from "../../ai/ComplaintReviewPanel";
import { FileText, Film } from "lucide-react";

function EvidenceLinks({ urls, files = [] }: { urls: string[]; files?: Array<{ url: string; fileType: string; fileName?: string | null }> }) {
  if (!urls.length) return <p className="text-sm text-on-surface-variant">Chưa có bằng chứng.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {urls.map((url, index) => {
        const file = files.find(entry => entry.url === url);
        const image = !file || file.fileType === "image";
        const Icon = file?.fileType === "video" ? Film : FileText;
        return <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="min-w-0 overflow-hidden rounded-xl border border-outline-variant hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary">
          {image ? <img src={url} alt={`Bằng chứng ${index + 1}`} width={320} height={144} loading="lazy" className="h-36 w-full object-cover" />
            : <div className="flex min-h-36 flex-col items-center justify-center gap-2 p-3 text-center"><Icon aria-hidden="true" size={28} /><span className="break-all text-sm">{file?.fileName || (file?.fileType === "video" ? "Video bằng chứng" : "Tài liệu bằng chứng")}</span></div>}
          <p className="p-2 text-xs font-semibold text-primary">{image ? "Mở ảnh gốc" : file?.fileType === "video" ? "Mở video gốc" : "Mở tài liệu gốc"}</p>
        </a>;
      })}
    </div>
  );
}

interface CaseDetailModalProps {
  open: boolean;
  detailLoading: boolean;
  selected: SelectedAdminCase | null;
  selectedTitle?: string;
  detailEvidence: string[];
  busy: boolean;
  onReverifyReport?: () => void;
  onOpenViolationForm: () => void;
  onClose: () => void;
  onAIUpdated?: () => void;
  onReviewBusyChange?: (busy: boolean) => void;
}

export function CaseDetailModal({
  open,
  detailLoading,
  selected,
  selectedTitle,
  detailEvidence,
  busy,
  onReverifyReport,
  onOpenViolationForm,
  onClose,
  onAIUpdated,
  onReviewBusyChange,
}: CaseDetailModalProps) {
  const hasReviewPanel = selected?.kind === "violation"
    || (selected?.kind === "report" && selected.item.status !== "cancelled" && !selected.item.createdViolationId
      && selected.item.isCustomerNoShow && ["pending", "under_review"].includes(selected.item.status));
  return (
    <Modal open={open} title={selectedTitle || "Chi tiết hồ sơ"} onClose={onClose} size="xl" closeOnOverlayClick={!busy}>
      {detailLoading && !selected ? (
        <div className="p-10 text-center text-on-surface-variant">Đang tải chi tiết...</div>
      ) : selected ? (
        <div className={`grid gap-6 ${hasReviewPanel ? "xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]" : "grid-cols-1"}`}>
          <div className="space-y-5">
            <section className="rounded-2xl bg-surface-container-low p-5">
              <div className="flex flex-wrap gap-2 text-xs text-on-surface-variant">
                <span className={`inline-flex rounded-full px-3 py-1 font-bold ${getCaseStatusClasses(selected.item.status)}`}>{CASE_STATUS_LABELS[selected.item.status] || selected.item.status}</span>
                <span>#{selected.item._id.slice(-8).toUpperCase()}</span>
                <span>{caseDateTime.format(new Date(selected.item.createdAt))}</span>
              </div>
              {selected.kind !== "violation" && <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{selected.kind === "report" && selected.item.isCustomerNoShow
                ? getNoShowUserDescription(selected.item.description) : selected.item.description}</p>}
              {selected.kind === "report" && !selected.item.isCustomerNoShow && selected.item.noShowVerification && <div className="mt-4 space-y-2 rounded-xl bg-primary/5 p-3 text-sm">
                <p className="font-bold">Kết quả xác minh bằng chứng{selected.item.reviewedByType === 'system' ? ' · Đã tự duyệt' : ''}</p>
                {selected.item.noShowVerification.reasons.map((reason, index) => <p key={index}>{reason}</p>)}
                <p className="text-xs text-on-surface-variant">{caseDateTime.format(new Date(selected.item.noShowVerification.checkedAt))}</p>
              </div>}
              {selected.kind === "violation" && (
                <>
                  <p className="mt-4 text-sm"><b>Người vi phạm:</b> {selected.item.userId.fullName} · {selected.item.userId.email}</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm"><b>Lý do:</b> {selected.item.reason}</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm"><b>Quyết định:</b> {selected.item.adminDecision}</p>
                </>
              )}
            </section>
            {selected.kind === "report" && !selected.item.isCustomerNoShow && <ComplaintReviewPanel key={selected.item._id} reportId={selected.item._id}
              active={!["confirmed", "resolved", "rejected", "cancelled"].includes(selected.item.status) && !selected.item.createdViolationId} onUpdated={onAIUpdated} reviewable={selected.item.status !== "cancelled" && !selected.item.createdViolationId} reviewBusy={busy} onReviewBusyChange={onReviewBusyChange} />}
            {selected.kind === "report" && selected.item.isCustomerNoShow && <NoShowVerificationSummary report={selected.item} />}
            {selected.kind === "report" && selected.item.isCustomerNoShow && ["pending", "under_review"].includes(selected.item.status)
              && !selected.item.createdViolationId && onReverifyReport && <div className="space-y-2 rounded-xl border border-outline-variant p-3 text-sm">
                <button type="button" disabled={busy} onClick={onReverifyReport} className="btn-secondary disabled:opacity-50">{busy ? "Đang xử lý..." : "Xác minh lại"}</button>
                <p className="text-xs text-on-surface-variant">Đối chiếu lại cuộc gọi trên bằng chứng và khoảng thời gian chờ đã lưu. Kết quả cũ được ghi vào lịch sử; admin tiếp tục quyết định xử lý báo cáo.</p>
              </div>}
            {selected.kind === "report" && selected.item.noShowDetails && <NoShowReviewDetails details={selected.item.noShowDetails} report={selected.item} />}
            {selected.kind !== "violation" && !(selected.kind === "report" && selected.item.noShowDetails?.evidence.length) && <section><h3 className="mb-3 font-bold">Bằng chứng</h3><EvidenceLinks urls={detailEvidence} files={selected.item.evidenceFiles} /></section>}
            {selected.kind === "report" && selected.item.evidenceFiles.some(file => file.note) && <section className="space-y-2 text-sm"><h3 className="font-bold">Ghi chú bằng chứng</h3>{selected.item.evidenceFiles.filter(file => file.note).map((file, index) => <p key={`${file.url}-${index}`}><b>{file.uploadedBy?.fullName || file.fileName || "Bằng chứng"}:</b> {file.note}</p>)}</section>}
            {selected.kind === "report" && selected.item.requestedEvidenceNote && (
              <section className="rounded-xl bg-warning-container p-4 text-sm text-on-warning-container">
                <b>Nội dung yêu cầu bổ sung:</b>
                <p className="mt-2">{selected.item.requestedEvidenceNote}</p>
              </section>
            )}
            {selected.kind !== "violation" && !(selected.kind === "report" && selected.item.isCustomerNoShow) && selected.item.resolutionNote && (
              <section className="rounded-xl bg-success-container p-4 text-sm text-on-success-container">
                <b>Kết quả xử lý:</b>
                <p className="mt-2 whitespace-pre-wrap">{selected.item.resolutionNote}</p>
              </section>
            )}
          </div>

          {hasReviewPanel && <aside className="space-y-5">
            {selected.kind === "report" && selected.item.isCustomerNoShow && ["pending", "under_review"].includes(selected.item.status) && !selected.item.createdViolationId && <section className="space-y-3">
              <p className="text-sm text-on-surface-variant">Chấp thuận báo cáo sẽ hủy đơn và Handigo chi hỗ trợ thợ 5.000đ; không thu thêm của khách. Kiểm tra mốc đến nơi, liên hệ và ảnh bằng chứng trước khi quyết định.</p>
              <ReportReviewForm key={selected.item._id} reportId={selected.item._id} customerNoShow busy={busy} onBusyChange={onReviewBusyChange} onUpdated={onAIUpdated} />
            </section>}
            {selected.kind === "violation" && (
              <section className="rounded-2xl border border-outline-variant p-4 text-sm">
                <p><b>Mức độ:</b> {VIOLATION_SEVERITY_LABELS[selected.item.severity]}</p>
                <p className="mt-2"><b>Hình phạt:</b> {PENALTY_LABELS[selected.item.penaltyType]}</p>
                {selected.item.penalty?.durationDays && <p className="mt-2"><b>Thời hạn:</b> {selected.item.penalty.durationDays} ngày</p>}
                {selected.item.endAt && <p className="mt-2"><b>Kết thúc:</b> {caseDateTime.format(new Date(selected.item.endAt))}</p>}
              </section>
            )}
          </aside>}
          {selected.kind === "report" && selected.item.status === "confirmed" && !selected.item.createdViolationId && (
            <div className="flex justify-end border-t border-outline-variant/40 pt-4 xl:col-span-full">
              <button type="button" onClick={onOpenViolationForm} disabled={busy} className="w-full rounded-xl bg-error px-6 py-3 font-bold text-on-error disabled:opacity-50 sm:w-auto sm:min-w-48">Tạo vi phạm</button>
            </div>
          )}
          {selected.kind !== "violation" && selected.item.createdViolationId && (
            <p className="rounded-xl bg-success-container p-4 text-sm font-semibold text-on-success-container xl:col-span-full">Hồ sơ đã tạo bản ghi vi phạm.</p>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
