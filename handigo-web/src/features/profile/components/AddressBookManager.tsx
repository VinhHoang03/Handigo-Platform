import { Plus, ShieldCheck } from "lucide-react";
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
  autoSelect?: boolean;
  compact?: boolean;
  singleAddressMode?: boolean;
  onManageAddresses?: () => void;
  onSelectAddress?: (address: UserAddress | null) => void;
}

export function AddressBookManager({
  defaultRecipient,
  selectedAddressId,
  selectable = false,
  autoSelect = true,
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
    handleSetDefault,
    confirmDelete,
  } = useAddressBookManager({
    selectedAddressId,
    selectable,
    autoSelect,
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
        <div className="flex flex-wrap items-center gap-2.5">
          <h4 className="font-headline-sm text-headline-sm text-on-surface">
            {singleAddressMode ? "Địa chỉ thực hiện" : "Địa chỉ đã lưu"}
          </h4>
          {!singleAddressMode && !isLoading && (
            <span className="text-xs text-on-surface-variant">
              {addresses.length} địa chỉ
            </span>
          )}
        </div>
        {!singleAddressMode && (
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
            onClick={openCreate}
          >
            <Plus aria-hidden="true" size={16} />
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
              ? "max-h-56 space-y-2 overflow-y-auto pr-1"
              : "space-y-3"
          }
        >
          {displayedAddresses.map((address) => (
            <AddressBookManagerRow
              key={address.id}
              address={address}
              selected={selectedAddressId === address.id}
              selectable={selectable}
              compact={compact}
              singleAddressMode={singleAddressMode}
              isSaving={isSaving}
              onSelect={() => onSelectAddress?.(address)}
              onEdit={() => openEdit(address)}
              onDelete={() => setDeleteTarget(address)}
              onSetDefault={() => void handleSetDefault(address)}
            />
          ))}
        </div>
      )}

      {!compact && !singleAddressMode && addresses.length > 0 && (
        <div className="mt-4 flex items-start gap-2.5 text-xs leading-5 text-on-surface-variant">
          <ShieldCheck
            aria-hidden="true"
            size={17}
            className="mt-0.5 shrink-0 text-primary"
          />
          <span>
            <strong className="font-semibold text-on-surface">
              Bảo mật thông tin địa chỉ
            </strong>
            <span className="block">
              Địa chỉ của bạn chỉ được chia sẻ với kỹ thuật viên sau khi đơn đặt dịch vụ được xác nhận.
            </span>
          </span>
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
