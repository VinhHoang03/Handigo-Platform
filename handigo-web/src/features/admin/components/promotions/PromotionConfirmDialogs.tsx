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
        title={isPausing ? "Tạm dừng mã giảm giá" : "Kích hoạt mã giảm giá"}
        message={`Bạn có chắc chắn muốn ${isPausing ? "tạm dừng" : "kích hoạt"} mã giảm giá "${toggleTarget?.code || ""}"?`}
        busy={busy}
        onCancel={onCancelToggle}
        onConfirm={onConfirmToggle}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa mã giảm giá"
        message={`Bạn có chắc chắn muốn xóa mã giảm giá "${deleteTarget?.code || ""}"? Thao tác này sẽ ẩn mã giảm giá khỏi danh sách quản lý.`}
        busy={busy}
        onCancel={onCancelDelete}
        onConfirm={onConfirmDelete}
      />
    </>
  );
}
