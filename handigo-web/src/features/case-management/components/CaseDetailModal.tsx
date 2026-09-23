import { useState, type FormEvent } from "react";
import { ExternalLink } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Modal } from "@/components/common/Modal";
import { Skeleton, SkeletonText } from "@/components/common/Skeleton";
import type {
  Complaint,
  EvidenceFile,
  Report,
  SupportTicket,
} from "../types/caseManagement.types";
import { EvidenceImagePicker } from "./EvidenceImagePicker";

export type SelectedCase =
  | { kind: "complaint"; item: Complaint }
  | { kind: "ticket"; item: SupportTicket }
  | { kind: "report"; item: Report };

interface CaseDetailModalProps {
  selected: SelectedCase | null;
  loading: boolean;
  busy: boolean;
  actionError: string;
  onClose: () => void;
  onCancel: () => Promise<boolean>;
  onAddEvidence: (files: File[], note: string) => Promise<boolean>;
  onRespond: (message: string, files: File[]) => Promise<boolean>;
}

const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });

function FileLinks({ files }: { files: EvidenceFile[] }) {
  if (!files.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {files.map((file, index) => (
        <a key={`${file.url}-${index}`} href={file.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-outline-variant px-3 py-2 text-xs font-semibold text-primary">
          {file.fileName || `Bằng chứng ${index + 1}`} <ExternalLink size={13} />
        </a>
      ))}
    </div>
  );
}

export function CaseDetailModal({
  selected,
  loading,
  busy,
  actionError,
  onClose,
  onCancel,
  onAddEvidence,
  onRespond,
}: CaseDetailModalProps) {
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const submitResponse = async (event: FormEvent) => {
    event.preventDefault();
    if (!reply.trim()) return;
    if (await onRespond(reply.trim(), files)) {
      setReply("");
      setFiles([]);
    }
  };

  const submitEvidence = async (event: FormEvent) => {
    event.preventDefault();
    if (!files.length) return;
    if (await onAddEvidence(files, note.trim())) {
      setFiles([]);
      setNote("");
    }
  };

  const title = selected?.kind === "complaint"
    ? "Chi tiết khiếu nại"
    : selected?.kind === "ticket"
      ? "Chi tiết yêu cầu hỗ trợ"
      : "Chi tiết báo cáo";

  return (
    <>
      <Modal open={Boolean(selected) || loading} title={title} onClose={onClose} size="xl" closeOnOverlayClick={!busy}>
        {loading && !selected ? (
          <div className="space-y-4" role="status" aria-busy="true" aria-label="Đang tải chi tiết">
            <Skeleton className="h-28 w-full" rounded="rounded-2xl" />
            <SkeletonText lines={4} />
          </div>
        ) : selected ? (
          <div className="space-y-6">
            <header className="rounded-2xl bg-surface-container-low p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                <span className="rounded-full bg-primary/10 px-3 py-1 font-bold text-primary">{selected.item.status}</span>
                <span>#{selected.item._id.slice(-8).toUpperCase()}</span>
                <span>{dateTime.format(new Date(selected.item.createdAt))}</span>
              </div>
              <h3 className="mt-3 text-xl font-bold">{"title" in selected.item ? selected.item.title : selected.item.subject}</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{selected.item.description}</p>
              {selected.item.orderId && <p className="mt-3 text-sm">Đơn liên quan: <b>{selected.item.orderId.orderCode}</b></p>}
              {"evidenceImages" in selected.item && <FileLinks files={selected.item.evidenceImages.map((url) => ({ fileType: "image", url }))} />}
              {"attachments" in selected.item && <FileLinks files={selected.item.attachments} />}
              {"evidenceFiles" in selected.item && <FileLinks files={selected.item.evidenceFiles} />}
            </header>

            {selected.kind === "complaint" && (
              <>
                {selected.item.requestedEvidenceNote && <section className="rounded-xl bg-warning-container p-4 text-sm text-on-warning-container"><b>Yêu cầu bổ sung bằng chứng:</b><p className="mt-1">{selected.item.requestedEvidenceNote}</p></section>}
                {selected.item.evidence?.map((evidence) => <section key={evidence._id} className="rounded-xl border border-outline-variant p-4"><p className="text-xs text-on-surface-variant">{evidence.uploadedBy.fullName} · {dateTime.format(new Date(evidence.createdAt))}</p>{evidence.note && <p className="mt-2 text-sm">{evidence.note}</p>}<FileLinks files={[evidence]} /></section>)}
                {!['resolved', 'rejected', 'cancelled'].includes(selected.item.status) && (
                  <form onSubmit={submitEvidence} className="rounded-2xl border border-outline-variant p-4">
                    <h3 className="font-bold">Bổ sung bằng chứng</h3>
                    <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={3} placeholder="Ghi chú cho bằng chứng..." className="mt-3 w-full rounded-xl border border-outline-variant p-3" />
                    <EvidenceImagePicker files={files} onChange={setFiles} disabled={busy} />
                    <button type="submit" disabled={busy || !files.length} className="btn-primary mt-3">{busy ? "Đang gửi..." : "Gửi bằng chứng"}</button>
                  </form>
                )}
              </>
            )}

            {selected.kind === "ticket" && (
              <>
                <section className="space-y-3">
                  <h3 className="font-bold">Trao đổi</h3>
                  {selected.item.responses.map((response, index) => <article key={`${response.respondedAt}-${index}`} className={`rounded-2xl border p-4 ${response.responderRole === "ADMIN" ? "ml-8 border-primary/20 bg-primary/5" : "mr-8 border-outline-variant"}`}><div className="flex justify-between gap-3 text-xs text-on-surface-variant"><b>{response.responderId?.fullName || (response.responderRole === "ADMIN" ? "Quản trị viên" : "Người dùng")}</b><span>{dateTime.format(new Date(response.respondedAt))}</span></div><p className="mt-2 whitespace-pre-wrap text-sm">{response.message}</p><FileLinks files={response.attachments} /></article>)}
                </section>
                {!['resolved', 'closed', 'cancelled'].includes(selected.item.status) && (
                  <form onSubmit={submitResponse} className="rounded-2xl border border-outline-variant p-4">
                    <label className="font-bold">Phản hồi</label>
                    <textarea value={reply} onChange={(event) => setReply(event.target.value)} minLength={1} maxLength={3000} rows={4} required className="mt-3 w-full rounded-xl border border-outline-variant p-3" />
                    <EvidenceImagePicker files={files} onChange={setFiles} disabled={busy} />
                    <button type="submit" disabled={busy || !reply.trim()} className="btn-primary mt-3">{busy ? "Đang gửi..." : "Gửi phản hồi"}</button>
                  </form>
                )}
              </>
            )}

            {selected.kind === "report" && selected.item.targetUserId && <section className="rounded-xl border border-outline-variant p-4 text-sm"><b>Đối tượng báo cáo:</b> {selected.item.targetUserId.fullName}{selected.item.targetUserId.email ? ` · ${selected.item.targetUserId.email}` : ""}</section>}

            {selected.item.resolutionNote && <section className="rounded-xl bg-success-container p-4 text-sm text-on-success-container"><b>Kết quả xử lý</b><p className="mt-2 whitespace-pre-wrap">{selected.item.resolutionNote}</p></section>}
            {actionError && <p className="rounded-xl bg-error/10 p-3 text-sm font-semibold text-error">{actionError}</p>}
            {selected.kind !== "report" && !['resolved', 'rejected', 'closed', 'cancelled'].includes(selected.item.status) && <button type="button" onClick={() => setConfirmCancel(true)} disabled={busy} className="rounded-xl border border-error px-4 py-2.5 font-semibold text-error">Hủy yêu cầu</button>}
          </div>
        ) : null}
      </Modal>
      <ConfirmDialog open={confirmCancel} title="Hủy yêu cầu" message="Bạn có chắc muốn hủy yêu cầu này? Thao tác không thể hoàn tác." busy={busy} variant="danger" onCancel={() => setConfirmCancel(false)} onConfirm={() => void onCancel().then((success) => success && setConfirmCancel(false))} />
    </>
  );
}
