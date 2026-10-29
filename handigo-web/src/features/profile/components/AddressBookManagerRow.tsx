import { Check, Pencil, Trash2 } from "lucide-react";
import type { UserAddress } from "@/features/profile/types/profile.types";
import { AddressLabelIcon } from "./AddressLabelIcon";
import {
  getAddressDisplay,
  getVisibleAddressNote,
} from "@/features/profile/utils/addressBookDisplay.utils";

interface AddressBookManagerRowProps {
  address: UserAddress;
  selected: boolean;
  selectable: boolean;
  compact: boolean;
  singleAddressMode: boolean;
  isSaving: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
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
  compact,
  singleAddressMode,
  isSaving,
  onSelect,
  onEdit,
  onDelete,
  onSetDefault,
}: AddressBookManagerRowProps) {
  const addressLabel = address.addressLabel?.trim() || "Địa chỉ khác";
  const visibleNote = getVisibleAddressNote(address);
  const addressDisplay = address.fullAddress?.trim() || getAddressDisplay(address);

  if (compact) {
    const compactContent = (
      <>
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
            selected
              ? "bg-primary text-on-primary"
              : "bg-surface-container-high text-primary"
          }`}
        >
          <AddressLabelIcon
            label={address.addressLabel}
            aria-hidden="true"
            size={18}
          />
        </span>
        <span className="min-w-0 flex-1 break-words text-sm font-medium leading-5 text-on-surface">
          {addressDisplay}
        </span>
      </>
    );

    return (
      <div
        className={`rounded-xl border bg-surface-container-lowest p-2.5 transition-colors ${
          selected
            ? "border-primary bg-primary/5"
            : "border-outline-variant/25 hover:border-primary/35"
        }`}
      >
        {selectable ? (
          <button
            type="button"
            aria-label={`Chọn địa chỉ ${addressDisplay}`}
            aria-pressed={selected}
            className="flex w-full min-w-0 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
            onClick={onSelect}
          >
            {compactContent}
          </button>
        ) : (
          <div className="flex min-w-0 items-center gap-3">
            {compactContent}
          </div>
        )}
      </div>
    );
  }

  const addressDetails = (
    <>
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
          selected
            ? "bg-primary text-on-primary"
            : "bg-surface-container-high text-primary"
        }`}
      >
        <AddressLabelIcon
          label={address.addressLabel}
          aria-hidden="true"
          size={18}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-on-surface">{addressLabel}</span>
          {address.isDefault && (
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              Mặc định
            </span>
          )}
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <strong className="font-semibold text-on-surface">
            {address.recipientName || "Chưa cập nhật người nhận"}
          </strong>
          {address.recipientPhone && (
            <span className="text-on-surface-variant">
              {address.recipientPhone}
            </span>
          )}
        </span>
        <span className="mt-1.5 block break-words text-sm leading-6 text-on-surface-variant">
          {addressDisplay}
        </span>
        {visibleNote && (
          <span className="mt-2 block border-l-2 border-outline-variant/60 pl-3 text-xs leading-5 text-on-surface-variant">
            Ghi chú: “{visibleNote}”
          </span>
        )}
      </span>
    </>
  );

  return (
    <div
      className={`rounded-2xl border bg-surface-container-lowest px-4 py-4 transition-colors ${
        selected
          ? "border-primary shadow-[0_8px_24px_-20px_rgba(67,56,202,0.65)]"
          : "border-outline-variant/25 hover:border-primary/35"
      }`}
    >
      {selectable ? (
        <button
          type="button"
          className="flex w-full min-w-0 items-start gap-3 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
          aria-pressed={selected}
          onClick={onSelect}
        >
          {addressDetails}
        </button>
      ) : (
        <div className="flex min-w-0 items-start gap-3">{addressDetails}</div>
      )}

      <div className="mt-3 flex min-h-10 flex-wrap items-center justify-between gap-2 border-t border-outline-variant/25 pt-3">
        <div className="text-xs font-medium text-on-surface-variant">
          {address.isDefault ? (
            <span className="inline-flex items-center gap-1.5">
              <Check aria-hidden="true" size={15} />
              Địa chỉ mặc định
            </span>
          ) : !singleAddressMode ? (
            <button
              type="button"
              className="min-h-9 rounded-lg px-2 text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 disabled:opacity-50"
              disabled={isSaving}
              onClick={onSetDefault}
            >
              Đặt làm mặc định
            </button>
          ) : selected ? (
            <span className="inline-flex items-center gap-1.5 text-primary">
              <Check aria-hidden="true" size={15} />
              Địa chỉ đang chọn
            </span>
          ) : null}
        </div>

        {!singleAddressMode && (
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              aria-label="Chỉnh sửa địa chỉ"
              title="Chỉnh sửa"
              className="grid h-9 w-9 place-items-center rounded-lg text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 disabled:opacity-50"
              disabled={isSaving}
              onClick={onEdit}
            >
              <Pencil aria-hidden="true" size={15} />
            </button>
            <button
              type="button"
              aria-label="Xóa địa chỉ"
              title="Xóa"
              className="grid h-9 w-9 place-items-center rounded-lg text-error transition-colors hover:bg-error/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-error/15 disabled:opacity-50"
              disabled={isSaving}
              onClick={onDelete}
            >
              <Trash2 aria-hidden="true" size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
