import { Modal } from "@/components/common/Modal";
import type {
  UserAddress,
  UserAddressPayload,
} from "@/features/profile/types/profile.types";
import { useAddressBookForm } from "@/features/profile/hooks/useAddressBookForm";
import { AddressBookFormFields } from "./AddressBookFormFields";
import { LocationPickerMap } from "@/components/common/LocationPickerMap";
import { AddressLabelBadge } from "./AddressLabelBadge";

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
    step,
    isSubmitting,
    backToDetails,
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
  const saving = Boolean(isSaving || isSubmitting);

  return (
    <Modal
      open={open}
      title={step === 'location' ? "Xác nhận vị trí địa chỉ" : address ? "Cập nhật địa chỉ" : "Thêm địa chỉ mới"}
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

        {step === 'details' ? <AddressBookFormFields
          addressForm={addressForm}
          provinceOptions={provinceOptions}
          wardOptions={wardOptions}
          isProvinceLoading={isProvinceLoading}
          isWardLoading={isWardLoading}
          isLocating={isLocating}
          isResolvingMapAddress={isResolvingMapAddress}
          isSaving={saving}
          showLocationPicker={false}
          onInputChange={handleAddressInputChange}
          onProvinceChange={handleProvinceChange}
          onWardChange={handleWardChange}
          onUseCurrentLocation={handleUseCurrentLocation}
          onPositionChange={updateAddressFromCoordinate}
        /> : <div className="space-y-4">
          <div className="rounded-xl bg-surface-container-low p-4 text-sm">
            <AddressLabelBadge label={addressForm.addressLabel} className="mb-2" />
            <p className="font-bold">{addressForm.recipientName} · {addressForm.recipientPhone}</p>
            <p className="mt-2">{[addressForm.addressLine, addressForm.ward, addressForm.province].filter(Boolean).join(', ')}</p>
            <p className="mt-2 text-xs text-on-surface-variant">Kiểm tra ghim và kéo đến đúng điểm thực hiện dịch vụ. Phần địa chỉ bạn nhập được giữ nguyên.</p>
          </div>
          {isResolvingMapAddress && !Number.isFinite(addressForm.latitude) ? (
            <div role="status" className="grid h-64 place-items-center rounded-2xl bg-surface-container-low text-sm text-on-surface-variant sm:h-72">
              Đang tìm vị trí theo địa chỉ và phường/xã đã chọn...
            </div>
          ) : <LocationPickerMap latitude={addressForm.latitude} longitude={addressForm.longitude}
            disabled={saving} isResolvingAddress={isResolvingMapAddress}
            onPositionChange={updateAddressFromCoordinate} />}
        </div>}

        {step === 'details' && <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-surface-container-low p-4">
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
        </label>}

        <div className="flex flex-col justify-end gap-3 pt-2 sm:flex-row">
          <button
            type="button"
            onClick={step === 'location' ? backToDetails : onClose}
            disabled={saving}
            className="btn-secondary"
          >
            {step === 'location' ? 'Quay lại chỉnh sửa' : 'Hủy'}
          </button>
          <button type="submit" disabled={saving || (step === 'location' && (isLocating || isResolvingMapAddress))} className="btn-primary">
            {saving
              ? "Đang lưu..."
              : step === 'details' ? "Tiếp tục xác nhận vị trí" : "Xác nhận vị trí và lưu"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
