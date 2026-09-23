import { Plus } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Skeleton } from "@/components/common/Skeleton";
import { AddressBookModal } from "./AddressBookModal";
import { AddressBookManagerRow } from "./AddressBookManagerRow";
import { useAddressBookManager } from "@/features/profile/hooks/useAddressBookManager";
import type { UserAddress } from "@/features/profile/types/profile.types";

interface AddressBookManagerProps {
  defaultRecipient: { name: string; phone: string };
  selectedAddressId?: string;
  selectable?: boolean;
  compact?: boolean;
  singleAddressMode?: boolean;
  onManageAddresses?: () => void;
  onSelectAddress?: (address: UserAddress | null) => void;
}

export function AddressBookManager({
  defaultRecipient,
  selectedAddressId,
  selectable = false,
  compact = false,
  singleAddressMode = false,
  onManageAddresses,
  onSelectAddress,
}: AddressBookManagerProps) {
  const {
    addresses,
    displayedAddresses,
    editingAddress,
    deleteTarget,
    isModalOpen,
    isLoading,
    isSaving,
    error,
    openCreate,
    openEdit,
    setIsModalOpen,
    setDeleteTarget,
    handleSubmit,
    confirmDelete,
  } = useAddressBookManager({
    selectedAddressId,
    selectable,
    singleAddressMode,
    onSelectAddress,
  });

  return (
    <div
      id="saved-addresses"
      className={
        compact
          ? "space-y-3"
          : "rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-5"
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-headline-sm text-headline-sm text-on-surface">
            {singleAddressMode ? "Địa chỉ thực hiện" : "Địa chỉ đã lưu"}
          </h4>
          {!compact && (
            <p className="mt-1 text-sm text-on-surface-variant">
              Dùng cho đặt lịch và hồ sơ tài khoản.
            </p>
          )}
        </div>
        {!singleAddressMode && (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
            onClick={openCreate}
          >
            <Plus size={16} />
            Thêm địa chỉ mới
          </button>
        )}
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-error/10 p-3 text-sm text-error">
          {error}
        </p>
      )}

      {isLoading ? (
        <div
          role="status"
          aria-busy="true"
          aria-label="Đang tải địa chỉ"
          className="space-y-2"
        >
          <Skeleton className="h-16 w-full" rounded="rounded-xl" />
          <Skeleton className="h-16 w-full" rounded="rounded-xl" />
        </div>
      ) : addresses.length === 0 ? (
        <button
          type="button"
          className="w-full rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-5 text-center text-on-surface-variant hover:border-primary hover:text-primary"
          onClick={() => {
            if (singleAddressMode && onManageAddresses) onManageAddresses();
            else openCreate();
          }}
        >
          Bạn chưa có địa chỉ. Nhấn để thêm địa chỉ mới.
        </button>
      ) : (
        <div
          className={
            compact
              ? "max-h-52 space-y-2 overflow-y-auto pr-1"
              : "space-y-3"
          }
        >
          {displayedAddresses.map((address) => (
            <AddressBookManagerRow
              key={address.id}
              address={address}
              selected={selectedAddressId === address.id}
              selectable={selectable}
              singleAddressMode={singleAddressMode}
              isSaving={isSaving}
              onSelect={() => onSelectAddress?.(address)}
              onEdit={() => openEdit(address)}
              onDelete={() => setDeleteTarget(address)}
            />
          ))}
        </div>
      )}

      {isModalOpen && (
        <AddressBookModal
          key={editingAddress?.id || "new-address"}
          open
          address={editingAddress}
          addressCount={addresses.length}
          isSaving={isSaving}
          defaultRecipient={defaultRecipient}
          onClose={() => {
            if (!isSaving) setIsModalOpen(false);
          }}
          onSubmit={handleSubmit}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa địa chỉ"
        message={`Bạn chắc chắn muốn xóa địa chỉ "${deleteTarget?.fullAddress || ""}"? Hành động này không thể khôi phục.`}
        busy={isSaving}
        variant="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
