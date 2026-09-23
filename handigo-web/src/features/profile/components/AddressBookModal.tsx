import { Modal } from "@/components/common/Modal";
import type {
  UserAddress,
  UserAddressPayload,
} from "@/features/profile/types/profile.types";
import { useAddressBookForm } from "@/features/profile/hooks/useAddressBookForm";
import { AddressBookFormFields } from "./AddressBookFormFields";

interface AddressBookModalProps {
  open: boolean;
  address?: UserAddress | null;
  addressCount: number;
  isSaving?: boolean;
  defaultRecipient: {
    name: string;
    phone: string;
  };
  onClose: () => void;
  onSubmit: (
    payload: UserAddressPayload,
    address: UserAddress | null,
  ) => Promise<void> | void;
}

export function AddressBookModal({
  open,
  address = null,
  addressCount,
  isSaving,
  defaultRecipient,
  onClose,
  onSubmit,
}: AddressBookModalProps) {
  const {
    addressForm,
    addressFormError,
    administrativeError,
    locationError,
    locationHint,
    provinceOptions,
    wardOptions,
    isProvinceLoading,
    isWardLoading,
    isLocating,
    isResolvingMapAddress,
    handleAddressInputChange,
    handleProvinceChange,
    handleWardChange,
    handleUseCurrentLocation,
    updateAddressFromCoordinate,
    handleSubmit,
  } = useAddressBookForm({
    open,
    address,
    addressCount,
    defaultRecipient,
    onSubmit,
    onClose,
  });

  return (
    <Modal
      open={open}
      title={address ? "Cập nhật địa chỉ" : "Thêm địa chỉ mới"}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {(addressFormError || administrativeError || locationError) && (
          <div className="rounded-2xl bg-error/10 p-3 text-sm text-error">
            {addressFormError || administrativeError || locationError}
          </div>
        )}

        {locationHint && !addressFormError && !locationError && (
          <div className="rounded-2xl bg-primary/10 p-3 text-sm text-primary">
            {locationHint}
          </div>
        )}

        <AddressBookFormFields
          addressForm={addressForm}
          provinceOptions={provinceOptions}
          wardOptions={wardOptions}
          isProvinceLoading={isProvinceLoading}
          isWardLoading={isWardLoading}
          isLocating={isLocating}
          isResolvingMapAddress={isResolvingMapAddress}
          isSaving={isSaving}
          onInputChange={handleAddressInputChange}
          onProvinceChange={handleProvinceChange}
          onWardChange={handleWardChange}
          onUseCurrentLocation={handleUseCurrentLocation}
          onPositionChange={(latitude, longitude) =>
            void updateAddressFromCoordinate(
              latitude,
              longitude,
              "Đã cập nhật địa chỉ theo vị trí ghim trên bản đồ.",
            )
          }
        />

        <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-surface-container-low p-4">
          <input
            type="checkbox"
            checked={Boolean(addressForm.isDefault)}
            onChange={(event) =>
              handleAddressInputChange("isDefault", event.target.checked)
            }
            className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary"
          />
          <span className="font-label-md text-on-surface">
            Đặt làm địa chỉ mặc định
          </span>
        </label>

        <div className="flex flex-col justify-end gap-3 pt-2 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="btn-secondary"
          >
            Hủy
          </button>
          <button type="submit" disabled={isSaving} className="btn-primary">
            {isSaving
              ? "Đang lưu..."
              : address
                ? "Cập nhật địa chỉ"
                : "Lưu địa chỉ"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
