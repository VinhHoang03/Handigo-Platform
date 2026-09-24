import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import type { Voucher } from "../../types/voucher.types";

export function PromotionConfirmDialogs({
  toggleTarget,
  deleteTarget,
  busy,
  onCancelToggle,
  onConfirmToggle,
  onCancelDelete,
  onConfirmDelete,
}: {
  toggleTarget: Voucher | null;
  deleteTarget: Voucher | null;
  busy: boolean;
  onCancelToggle: () => void;
  onConfirmToggle: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const isPausing = Boolean(toggleTarget?.isActive && toggleTarget.status === "ACTIVE");

  return (
    <>
      <ConfirmDialog
        open={Boolean(toggleTarget)}
        title={isPausing ? "Tạm dừng voucher" : "Kích hoạt voucher"}
        message={`Bạn có chắc chắn muốn ${isPausing ? "tạm dừng" : "kích hoạt"} voucher "${toggleTarget?.code || ""}"?`}
        busy={busy}
        onCancel={onCancelToggle}
        onConfirm={onConfirmToggle}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa voucher"
        message={`Bạn có chắc chắn muốn xóa voucher "${deleteTarget?.code || ""}"? Thao tác này sẽ ẩn voucher khỏi danh sách quản lý.`}
        busy={busy}
        onCancel={onCancelDelete}
        onConfirm={onConfirmDelete}
      />
    </>
  );
}
