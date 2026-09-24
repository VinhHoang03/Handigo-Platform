import { useState } from "react";
import { Check, X } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FloatingTextarea } from "@/components/common/FloatingField";
import { Modal } from "@/components/common/Modal";
import type { AdminWithdrawal } from "../../types/admin.types";
import { withdrawalDateTime, withdrawalMoney } from "./withdrawal-table-columns";

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-container-low p-3">
      <p className="text-xs font-semibold uppercase text-on-surface-variant">{label}</p>
      <p className="mt-1 font-bold text-on-surface">{value}</p>
    </div>
  );
}

const statusLabelFor = (status: AdminWithdrawal["status"]) =>
  status === "approved" ? "Đã duyệt" : status === "rejected" ? "Từ chối" : "Chờ duyệt";

interface WithdrawalDetailModalProps {
  withdrawal: AdminWithdrawal | null;
  busy: boolean;
  adminNote: string;
  onNoteChange: (value: string) => void;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
}

/**
 * Modal chi tiết + bước xác nhận (`ConfirmDialog`) trước khi duyệt/từ chối rút
 * tiền thật. `onApprove`/`onReject` chỉ được gọi sau khi admin xác nhận trong
 * `ConfirmDialog` — không gọi API ngay khi bấm nút đầu tiên.
 */
export function WithdrawalDetailModal({
  withdrawal,
  busy,
  adminNote,
  onNoteChange,
  onClose,
  onApprove,
  onReject,
}: WithdrawalDetailModalProps) {
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previousId, setPreviousId] = useState(withdrawal?._id);

  // Reset bước xác nhận khi mở một yêu cầu khác — điều chỉnh state trong lúc
  // render thay vì dùng useEffect (tránh cascading render không cần thiết).
  if (withdrawal?._id !== previousId) {
    setPreviousId(withdrawal?._id);
    setAction(null);
    setConfirmOpen(false);
  }

  const handleClose = () => {
    setAction(null);
    setConfirmOpen(false);
    onClose();
  };

  const confirmSubmit = () => {
    setConfirmOpen(false);
    if (action === "approve") onApprove();
    else if (action === "reject") onReject();
  };

  return (
    <>
      <Modal open={Boolean(withdrawal)} title="Chi tiết yêu cầu rút tiền" onClose={handleClose} size="lg">
        {withdrawal && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Nhà cung cấp" value={withdrawal.userId.fullName} />
              <Info label="Email" value={withdrawal.userId.email} />
              <Info label="Số tiền" value={withdrawalMoney.format(withdrawal.amount)} />
              <Info label="Trạng thái" value={statusLabelFor(withdrawal.status)} />
              <Info label="Ngày tạo" value={withdrawalDateTime.format(new Date(withdrawal.createdAt))} />
              <Info
                label="Ngày xử lý"
                value={withdrawal.reviewedAt ? withdrawalDateTime.format(new Date(withdrawal.reviewedAt)) : "Chưa xử lý"}
              />
            </div>

            <section className="rounded-lg border border-outline-variant/40 p-4">
              <h3 className="font-bold">Tài khoản ngân hàng</h3>
              {typeof withdrawal.bankAccountId === "object" && withdrawal.bankAccountId ? (
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <p><b>Ngân hàng:</b> {withdrawal.bankAccountId.bankName}</p>
                  <p><b>Mã ngân hàng:</b> {withdrawal.bankAccountId.bankCode}</p>
                  <p><b>Số tài khoản:</b> {withdrawal.bankAccountId.accountNumber}</p>
                  <p><b>Chủ tài khoản:</b> {withdrawal.bankAccountId.accountHolderName}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-on-surface-variant">Chưa có thông tin tài khoản nhận.</p>
              )}
            </section>

            {withdrawal.adminNote && (
              <p className="rounded-lg bg-surface-container-low p-3 text-sm">
                <b>Ghi chú admin:</b> {withdrawal.adminNote}
              </p>
            )}

            {withdrawal.status === "pending" && (
              <div className="space-y-3">
                {action && (
                  <FloatingTextarea
                    id="withdrawal-admin-note"
                    label="Ghi chú xử lý"
                    value={adminNote}
                    rows={4}
                    onValueChange={onNoteChange}
                  />
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setAction(action === "reject" ? null : "reject")}
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-error/10 py-3 font-semibold text-error disabled:opacity-50"
                  >
                    <X size={18} /> Từ chối
                  </button>
                  <button
                    type="button"
                    onClick={() => (action === "approve" ? setConfirmOpen(true) : setAction("approve"))}
                    disabled={busy}
                    className="btn-primary"
                  >
                    <Check size={18} /> {busy ? "Đang xử lý..." : action === "approve" ? "Xác nhận duyệt" : "Duyệt"}
                  </button>
                </div>
                {action === "reject" && (
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(true)}
                    disabled={busy}
                    className="w-full rounded-lg bg-error py-3 font-semibold text-on-error disabled:opacity-50"
                  >
                    {busy ? "Đang xử lý..." : "Xác nhận từ chối"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title={action === "approve" ? "Xác nhận duyệt rút tiền" : "Xác nhận từ chối rút tiền"}
        message={
          action === "approve"
            ? `Duyệt yêu cầu rút ${withdrawal ? withdrawalMoney.format(withdrawal.amount) : ""} cho ${withdrawal?.userId.fullName ?? ""}? Tiền sẽ được chuyển khoản thật và không thể hoàn tác.`
            : `Từ chối yêu cầu rút tiền của ${withdrawal?.userId.fullName ?? ""} và hoàn tiền về ví? Hành động này không thể hoàn tác.`
        }
        busy={busy}
        variant={action === "reject" ? "danger" : "default"}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={confirmSubmit}
      />
    </>
  );
}
