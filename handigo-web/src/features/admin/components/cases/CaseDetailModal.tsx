import { Modal } from "@/components/common/Modal";
import { caseDateTime } from "./case-table-columns";
import type { SelectedAdminCase } from "./case-detail.types";
import { CASE_STATUS_LABELS } from "./case-status.constants";

function EvidenceLinks({ urls }: { urls: string[] }) {
  if (!urls.length) return <p className="text-sm text-on-surface-variant">Chưa có bằng chứng.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {urls.map((url, index) => (
        <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-outline-variant">
          <img src={url} alt={`Bằng chứng ${index + 1}`} className="h-36 w-full object-cover" />
          <p className="p-2 text-xs font-semibold text-primary">Mở ảnh gốc</p>
        </a>
      ))}
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
  actionError: string;
  evidenceNote: string;
  onEvidenceNoteChange: (value: string) => void;
  onRequestEvidence: () => void;
  nextStatus: string;
  onNextStatusChange: (value: string) => void;
  reviewNote: string;
  onReviewNoteChange: (value: string) => void;
  resolutionNote: string;
  onResolutionNoteChange: (value: string) => void;
  onUpdateComplaint: () => void;
  onReviewReport: () => void;
  onOpenViolationForm: () => void;
  onClose: () => void;
}

export function CaseDetailModal({
  open,
  detailLoading,
  selected,
  selectedTitle,
  detailEvidence,
  busy,
  actionError,
  evidenceNote,
  onEvidenceNoteChange,
  onRequestEvidence,
  nextStatus,
  onNextStatusChange,
  reviewNote,
  onReviewNoteChange,
  resolutionNote,
  onResolutionNoteChange,
  onUpdateComplaint,
  onReviewReport,
  onOpenViolationForm,
  onClose,
}: CaseDetailModalProps) {
  return (
    <Modal open={open} title={selectedTitle || "Chi tiết hồ sơ"} onClose={onClose} size="xl" closeOnOverlayClick={!busy}>
      {detailLoading && !selected ? (
        <div className="p-10 text-center text-on-surface-variant">Đang tải chi tiết...</div>
      ) : selected ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
          <div className="space-y-5">
            <section className="rounded-2xl bg-surface-container-low p-5">
              <div className="flex flex-wrap gap-2 text-xs text-on-surface-variant">
                <span className="rounded-full bg-primary/10 px-3 py-1 font-bold text-primary">{CASE_STATUS_LABELS[selected.item.status] || selected.item.status}</span>
                <span>#{selected.item._id.slice(-8).toUpperCase()}</span>
                <span>{caseDateTime.format(new Date(selected.item.createdAt))}</span>
              </div>
              {selected.kind !== "violation" && <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{selected.item.description}</p>}
              {selected.kind === "violation" && (
                <>
                  <p className="mt-4 text-sm"><b>Người vi phạm:</b> {selected.item.userId.fullName} · {selected.item.userId.email}</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm"><b>Lý do:</b> {selected.item.reason}</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm"><b>Quyết định:</b> {selected.item.adminDecision}</p>
                </>
              )}
            </section>
            {selected.kind !== "violation" && <section><h3 className="mb-3 font-bold">Bằng chứng</h3><EvidenceLinks urls={detailEvidence} /></section>}
            {selected.kind === "complaint" && selected.item.requestedEvidenceNote && (
              <section className="rounded-xl bg-warning-container p-4 text-sm text-on-warning-container">
                <b>Nội dung yêu cầu bổ sung:</b>
                <p className="mt-2">{selected.item.requestedEvidenceNote}</p>
              </section>
            )}
            {selected.kind !== "violation" && selected.item.resolutionNote && (
              <section className="rounded-xl bg-success-container p-4 text-sm text-on-success-container">
                <b>Kết quả xử lý:</b>
                <p className="mt-2 whitespace-pre-wrap">{selected.item.resolutionNote}</p>
              </section>
            )}
          </div>

          <aside className="space-y-5">
            {selected.kind === "complaint" && !["resolved", "rejected", "cancelled"].includes(selected.item.status) && (
              <>
                <section className="rounded-2xl border border-outline-variant p-4">
                  <h3 className="font-bold">Yêu cầu bổ sung bằng chứng</h3>
                  <textarea value={evidenceNote} onChange={(event) => onEvidenceNoteChange(event.target.value)} minLength={5} maxLength={3000} rows={4} className="mt-3 w-full rounded-xl border border-outline-variant p-3" />
                  <button type="button" onClick={onRequestEvidence} disabled={busy || evidenceNote.trim().length < 5} className="btn-primary mt-3 w-full">Gửi yêu cầu</button>
                </section>
                <section className="rounded-2xl border border-outline-variant p-4">
                  <h3 className="font-bold">Cập nhật kết quả</h3>
                  <select value={nextStatus} onChange={(event) => onNextStatusChange(event.target.value)} className="mt-3 min-h-11 w-full rounded-xl border border-outline-variant px-3">
                    <option value="">Chọn trạng thái</option>
                    <option value="under_review">Đang xem xét</option>
                    <option value="resolved">Đã xử lý</option>
                    <option value="rejected">Từ chối</option>
                  </select>
                  <textarea value={resolutionNote} onChange={(event) => onResolutionNoteChange(event.target.value)} maxLength={3000} rows={4} placeholder="Kết luận xử lý..." className="mt-3 w-full rounded-xl border border-outline-variant p-3" />
                  <button type="button" onClick={onUpdateComplaint} disabled={busy || !nextStatus} className="btn-primary mt-3 w-full">Cập nhật</button>
                </section>
              </>
            )}
            {selected.kind === "report" && !selected.item.createdViolationId && (
              <section className="rounded-2xl border border-outline-variant p-4">
                <h3 className="font-bold">Review báo cáo</h3>
                <select value={nextStatus} onChange={(event) => onNextStatusChange(event.target.value)} className="mt-3 min-h-11 w-full rounded-xl border border-outline-variant px-3">
                  <option value="">Chọn trạng thái</option>
                  <option value="under_review">Đang xem xét</option>
                  <option value="confirmed">Xác nhận</option>
                  <option value="rejected">Từ chối</option>
                  <option value="resolved">Đã xử lý</option>
                </select>
                <textarea value={reviewNote} onChange={(event) => onReviewNoteChange(event.target.value)} maxLength={3000} rows={3} placeholder="Ghi chú review..." className="mt-3 w-full rounded-xl border border-outline-variant p-3" />
                <textarea value={resolutionNote} onChange={(event) => onResolutionNoteChange(event.target.value)} maxLength={3000} rows={3} placeholder="Kết luận xử lý..." className="mt-3 w-full rounded-xl border border-outline-variant p-3" />
                <button type="button" onClick={onReviewReport} disabled={busy || !nextStatus} className="btn-primary mt-3 w-full">Cập nhật</button>
              </section>
            )}
            {selected.kind !== "violation" && !selected.item.createdViolationId && (
              <button type="button" onClick={onOpenViolationForm} className="w-full rounded-xl bg-error px-4 py-3 font-bold text-on-error">Tạo vi phạm và áp dụng penalty</button>
            )}
            {selected.kind !== "violation" && selected.item.createdViolationId && (
              <p className="rounded-xl bg-success-container p-4 text-sm font-semibold text-on-success-container">Hồ sơ đã tạo bản ghi vi phạm.</p>
            )}
            {selected.kind === "violation" && (
              <section className="rounded-2xl border border-outline-variant p-4 text-sm">
                <p><b>Mức độ:</b> {selected.item.severity}</p>
                <p className="mt-2"><b>Hình phạt:</b> {selected.item.penaltyType}</p>
                {selected.item.penalty?.durationDays && <p className="mt-2"><b>Thời hạn:</b> {selected.item.penalty.durationDays} ngày</p>}
                {selected.item.endAt && <p className="mt-2"><b>Kết thúc:</b> {caseDateTime.format(new Date(selected.item.endAt))}</p>}
              </section>
            )}
            {actionError && <p className="rounded-xl bg-error/10 p-3 text-sm font-semibold text-error">{actionError}</p>}
          </aside>
        </div>
      ) : null}
    </Modal>
  );
}
