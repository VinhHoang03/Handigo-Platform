import { MapPin, Pencil, Trash2 } from "lucide-react";
import type { UserAddress } from "@/features/profile/types/profile.types";
import {
  getAddressDisplay,
  getAddressTitle,
  getVisibleAddressNote,
} from "@/features/profile/utils/addressBookDisplay.utils";

interface AddressBookManagerRowProps {
  address: UserAddress;
  selected: boolean;
  selectable: boolean;
  singleAddressMode: boolean;
  isSaving: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Hàng địa chỉ dùng riêng cho AddressBookManager: hỗ trợ chọn (selectable),
 * làm nổi bật khi được chọn và ẩn nút sửa/xóa ở chế độ singleAddressMode.
 * Khác với `SavedAddressRow` (không có chế độ chọn) nên giữ component riêng.
 */
export function AddressBookManagerRow({
  address,
  selected,
  selectable,
  singleAddressMode,
  isSaving,
  onSelect,
  onEdit,
  onDelete,
}: AddressBookManagerRowProps) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-3 transition ${
        selected
          ? "border-primary bg-primary/5"
          : "border-outline-variant/30 bg-surface-container-low hover:border-primary/50"
      }`}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-start gap-3 text-left"
        onClick={() => selectable && onSelect()}
      >
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
            selected ? "bg-primary text-on-primary" : "bg-primary/10 text-primary"
          }`}
        >
          <MapPin size={18} />
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2 font-bold text-on-surface">
            {getAddressTitle(address)}
            {address.isDefault && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase text-primary">
                Mặc định
              </span>
            )}
          </span>
          {getVisibleAddressNote(address) && (
            <span className="mt-1 block text-sm text-on-surface-variant">
              {getAddressDisplay(address)}
            </span>
          )}
          <span className="mt-1 block text-xs text-on-surface-variant">
            Người nhận: {address.recipientName || "Chưa cập nhật"}
            {address.recipientPhone ? ` • ${address.recipientPhone}` : ""}
          </span>
        </span>
      </button>
      {!singleAddressMode && (
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            aria-label="Sửa địa chỉ"
            className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant hover:bg-primary/10 hover:text-primary"
            disabled={isSaving}
            onClick={onEdit}
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            aria-label="Xóa địa chỉ"
            className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant hover:bg-error/10 hover:text-error"
            disabled={isSaving}
            onClick={onDelete}
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
