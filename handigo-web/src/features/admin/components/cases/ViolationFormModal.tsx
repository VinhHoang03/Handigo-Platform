import { useState, type FormEvent } from "react";
import { Modal } from "@/components/common/Modal";
import type {
  CreateViolationPayload,
  PenaltyType,
  ViolationSeverity,
  ViolationSourceType,
} from "@/features/case-management/types/caseManagement.types";
import { getErrorMessage } from "@/utils/apiError";
import { adminCasesApi } from "../../api/adminCases.api";

interface ViolationFormModalProps {
  open: boolean;
  sourceType: ViolationSourceType;
  sourceId: string;
  userId?: string;
  orderId?: string;
  onClose: () => void;
  onCreated: () => void;
}

const PENALTIES: Array<{ value: PenaltyType; label: string }> = [
  { value: "WARNING", label: "Cảnh cáo" },
  { value: "TEMPORARY_SUSPEND", label: "Tạm khóa tài khoản" },
  { value: "PERMANENT_BAN", label: "Khóa tài khoản vĩnh viễn" },
  { value: "RESTRICT_FEATURE", label: "Hạn chế tính năng" },
  { value: "RESTRICT_ORDER_RECEIVING", label: "Hạn chế nhận đơn" },
  { value: "RESTRICT_CHAT", label: "Hạn chế trò chuyện" },
  { value: "RESTRICT_VOUCHER", label: "Hạn chế voucher" },
];

export function ViolationFormModal({
  open,
  sourceType,
  sourceId,
  userId,
  orderId,
  onClose,
  onCreated,
}: ViolationFormModalProps) {
  const [targetUserId, setTargetUserId] = useState(userId || "");
  const [violationType, setViolationType] = useState("");
  const [severity, setSeverity] = useState<ViolationSeverity>("MEDIUM");
  const [reason, setReason] = useState("");
  const [adminDecision, setAdminDecision] = useState("");
  const [penaltyType, setPenaltyType] = useState<PenaltyType>("WARNING");
  const [feature, setFeature] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [penaltyNote, setPenaltyNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const payload: CreateViolationPayload = {
      userId: targetUserId || undefined,
      sourceType,
      sourceId,
      orderId,
      violationType: violationType.trim(),
      severity,
      reason: reason.trim(),
      adminDecision: adminDecision.trim(),
      penalty: {
        type: penaltyType,
        feature: feature.trim() || undefined,
        durationDays: durationDays ? Number(durationDays) : undefined,
        note: penaltyNote.trim() || undefined,
      },
    };

    try {
      setBusy(true);
      setError("");
      await adminCasesApi.createViolation(payload);
      onCreated();
      onClose();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Không thể tạo bản ghi vi phạm."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title="Tạo vi phạm và áp dụng hình phạt" onClose={onClose} size="lg" danger closeOnEsc={!busy} closeOnOverlayClick={!busy}>
      <form onSubmit={submit} className="space-y-4">
        {sourceType === "SUPPORT_TICKET" && <label className="block text-sm font-semibold">ID người dùng vi phạm<input value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)} pattern="[0-9a-fA-F]{24}" required disabled={busy} placeholder="Nhập MongoDB ObjectId của người vi phạm" className="mt-2 min-h-12 w-full rounded-xl border border-outline-variant px-3" /><span className="mt-2 block text-xs font-normal text-on-surface-variant">Ticket không xác định sẵn bên vi phạm; quản trị viên phải chọn đúng người dùng sau khi review nội dung.</span></label>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">Loại vi phạm<input value={violationType} onChange={(event) => setViolationType(event.target.value)} minLength={2} maxLength={100} required disabled={busy} className="mt-2 min-h-12 w-full rounded-xl border border-outline-variant px-3" /></label>
          <label className="text-sm font-semibold">Mức độ<select value={severity} onChange={(event) => setSeverity(event.target.value as ViolationSeverity)} disabled={busy} className="mt-2 min-h-12 w-full rounded-xl border border-outline-variant px-3"><option value="LOW">Thấp</option><option value="MEDIUM">Trung bình</option><option value="HIGH">Cao</option><option value="CRITICAL">Nghiêm trọng</option></select></label>
        </div>
        <label className="block text-sm font-semibold">Lý do xác nhận vi phạm<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={5} maxLength={3000} rows={4} required disabled={busy} className="mt-2 w-full rounded-xl border border-outline-variant p-3" /></label>
        <label className="block text-sm font-semibold">Quyết định xử lý<textarea value={adminDecision} onChange={(event) => setAdminDecision(event.target.value)} minLength={5} maxLength={3000} rows={4} required disabled={busy} className="mt-2 w-full rounded-xl border border-outline-variant p-3" /></label>
        <label className="block text-sm font-semibold">Hình phạt<select value={penaltyType} onChange={(event) => setPenaltyType(event.target.value as PenaltyType)} disabled={busy} className="mt-2 min-h-12 w-full rounded-xl border border-outline-variant px-3">{PENALTIES.map((penalty) => <option key={penalty.value} value={penalty.value}>{penalty.label}</option>)}</select></label>
        {penaltyType === "TEMPORARY_SUSPEND" && <label className="block text-sm font-semibold">Thời hạn (ngày)<input type="number" value={durationDays} onChange={(event) => setDurationDays(event.target.value)} min={1} max={3650} required disabled={busy} className="mt-2 min-h-12 w-full rounded-xl border border-outline-variant px-3" /></label>}
        {penaltyType === "RESTRICT_FEATURE" && <label className="block text-sm font-semibold">Tính năng bị hạn chế<input value={feature} onChange={(event) => setFeature(event.target.value)} maxLength={100} required disabled={busy} className="mt-2 min-h-12 w-full rounded-xl border border-outline-variant px-3" /></label>}
        <label className="block text-sm font-semibold">Ghi chú hình phạt<textarea value={penaltyNote} onChange={(event) => setPenaltyNote(event.target.value)} maxLength={1000} rows={3} disabled={busy} className="mt-2 w-full rounded-xl border border-outline-variant p-3" /></label>
        {error && <p className="rounded-xl bg-error/10 p-3 text-sm font-semibold text-error">{error}</p>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} disabled={busy} className="btn-secondary">Quay lại</button><button type="submit" disabled={busy || (sourceType === "SUPPORT_TICKET" && !targetUserId)} className="rounded-xl bg-error px-5 py-2.5 font-semibold text-on-error disabled:opacity-40">{busy ? "Đang áp dụng..." : "Xác nhận vi phạm"}</button></div>
      </form>
    </Modal>
  );
}
