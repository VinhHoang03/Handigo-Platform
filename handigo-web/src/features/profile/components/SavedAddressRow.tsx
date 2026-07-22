import { MapPin, Pencil, Trash2 } from "lucide-react";
import type { UserAddress } from "@/features/profile/types/profile.types";

const CURRENT_LOCATION_LEGACY_NOTE =
  "Địa chỉ được tạo từ vị trí hiện tại khi đặt dịch vụ.";

interface SavedAddressRowProps {
  address: UserAddress;
  disabled?: boolean;
  onEdit?: (address: UserAddress) => void;
  onDelete?: (address: UserAddress) => void;
}

export function SavedAddressRow({
  address,
  disabled,
  onEdit,
  onDelete,
}: SavedAddressRowProps) {
  const hasNote = Boolean(
    address.note?.trim() && address.note.trim() !== CURRENT_LOCATION_LEGACY_NOTE,
  );

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-outline-variant/20 bg-surface-container-low p-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <MapPin size={18} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {hasNote && (
              <p className="font-bold text-on-surface">
                {address.note?.trim()}
              </p>
            )}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">
            {address.fullAddress}
          </p>
          {(address.recipientName || address.recipientPhone) && (
            <p className="mt-1 text-xs text-on-surface-variant">
              Người nhận: {address.recipientName || "Chưa cập nhật"}
              {address.recipientPhone ? ` • ${address.recipientPhone}` : ""}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <div className="flex gap-1">
          {onEdit && (
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant transition hover:bg-primary/10 hover:text-primary disabled:opacity-40"
              disabled={disabled}
              title="Sửa địa chỉ"
              aria-label="Sửa địa chỉ"
              onClick={() => onEdit(address)}
            >
              <Pencil size={17} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant transition hover:bg-error/10 hover:text-error disabled:opacity-40"
              disabled={disabled}
              title="Xóa địa chỉ"
              aria-label="Xóa địa chỉ"
              onClick={() => onDelete(address)}
            >
              <Trash2 size={17} />
            </button>
          )}
        </div>
        {address.isDefault && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
            Mặc định
          </span>
        )}
      </div>
    </div>
  );
}
