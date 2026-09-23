import { Plus } from "lucide-react";
import type { UserAddress } from "@/features/profile/types/profile.types";
import { SavedAddressRow } from "./SavedAddressRow";
import { Skeleton } from "@/components/common/Skeleton";

interface SavedAddressesPanelProps {
  addresses: UserAddress[];
  isLoading?: boolean;
  isSaving?: boolean;
  error?: string;
  onAddAddress?: () => void;
  onEditAddress?: (address: UserAddress) => void;
  onDeleteAddress?: (address: UserAddress) => void;
}

export function SavedAddressesPanel({
  addresses,
  isLoading,
  isSaving,
  error,
  onAddAddress,
  onEditAddress,
  onDeleteAddress,
}: SavedAddressesPanelProps) {
  return (
    <div className="min-w-0 rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-headline-sm text-headline-sm text-on-surface">
            Địa chỉ đã lưu
          </h4>
          <p className="mt-1 text-sm text-on-surface-variant">
            Dùng cho đặt lịch và hồ sơ tài khoản.
          </p>
        </div>
        {onAddAddress && (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
            onClick={onAddAddress}
          >
            <Plus size={16} />
            Thêm địa chỉ mới
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-error/10 p-3 text-sm font-medium text-error">
          {error}
        </div>
      )}

      {isLoading ? (
        <div role="status" aria-busy="true" aria-label="Đang tải địa chỉ" className="space-y-2">
          <Skeleton className="h-16 w-full" rounded="rounded-lg" />
          <Skeleton className="h-16 w-full" rounded="rounded-lg" />
        </div>
      ) : addresses.length > 0 ? (
        <div className="space-y-3">
          {addresses.map((address) => (
            <SavedAddressRow
              key={address.id}
              address={address}
              disabled={isSaving}
              onEdit={onEditAddress}
              onDelete={onDeleteAddress}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-outline-variant/60 bg-surface-container-low p-5 text-center text-on-surface-variant">
          Chưa có địa chỉ đã lưu.
        </div>
      )}
    </div>
  );
}
