import { Check, X } from "lucide-react";
import { useState } from "react";
import { FloatingTextarea } from "@/components/common/FloatingField";
import type { AdminApplication } from "../../types/admin.types";
import { rejectionReasons } from "./application-detail.utils";

interface ApplicationReviewActionsProps {
  applicationType: AdminApplication["applicationType"];
  busy: boolean;
  onApprove: () => void;
  onReject: (reason: string, notes: string) => void;
}

export function ApplicationReviewActions({ applicationType, busy, onApprove, onReject }: ApplicationReviewActionsProps) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [notes, setNotes] = useState("");

  const finalReason = reason === "Khác" ? customReason.trim() : reason.trim();
  const canSubmitReject = Boolean(finalReason) && Boolean(notes.trim());

  return (
    <section className="space-y-4 border-t border-outline-variant/30 pt-6">
      {rejecting && (
        <div className="space-y-4 rounded-2xl bg-surface-container-low p-4">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-on-surface">Lý do từ chối</span>
            <select
              className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none transition-colors hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            >
              <option value="">Chọn lý do</option>
              {rejectionReasons.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          {reason === "Khác" && (
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-on-surface">Lý do khác</span>
              <input
                value={customReason}
                maxLength={200}
                onChange={(event) => setCustomReason(event.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none transition-colors hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Nhập lý do từ chối..."
              />
            </label>
          )}
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-on-surface">Ghi chú chi tiết (bắt buộc)</span>
            <FloatingTextarea id="application-rejection-notes" label="" value={notes} rows={4} maxLength={2000} onValueChange={setNotes} />
          </label>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {!rejecting ? (
          <>
            <button
              type="button"
              onClick={() => setRejecting(true)}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-error/30 bg-error/5 py-3 font-semibold text-error transition-all hover:bg-error/10 disabled:opacity-50"
            >
              <X size={18} /> Từ chối
            </button>
            <button type="button" onClick={onApprove} disabled={busy} className="btn-primary">
              <Check size={18} /> {busy ? "Đang xử lý..." : applicationType === "service_addition" ? "Duyệt thêm dịch vụ" : "Phê duyệt provider"}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setRejecting(false)}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest py-3 font-semibold text-on-surface transition-all hover:bg-surface-container-low disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => onReject(finalReason, notes)}
              disabled={busy || !canSubmitReject}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-error/10 py-3 font-semibold text-error transition-all hover:bg-error/20 disabled:opacity-50"
            >
              <X size={18} /> {busy ? "Đang xử lý..." : "Xác nhận từ chối"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
