import { LocateFixed, RefreshCw } from "lucide-react";
import { LocationPickerMap } from "@/components/common/LocationPickerMap";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/common/SearchableSelect";
import { FloatingTextarea } from "@/components/common/FloatingField";
import type { AddressFormState } from "@/features/profile/utils/addressBookForm.utils";

interface AddressBookFormFieldsProps {
  addressForm: AddressFormState;
  provinceOptions: SearchableSelectOption[];
  wardOptions: SearchableSelectOption[];
  isProvinceLoading: boolean;
  isWardLoading: boolean;
  isLocating: boolean;
  isResolvingMapAddress: boolean;
  isSaving?: boolean;
  onInputChange: (field: keyof AddressFormState, value: string | boolean) => void;
  onProvinceChange: (option: SearchableSelectOption | null) => void;
  onWardChange: (option: SearchableSelectOption | null) => void;
  onUseCurrentLocation: () => void;
  onPositionChange: (latitude: number, longitude: number) => void;
}

export function AddressBookFormFields({
  addressForm,
  provinceOptions,
  wardOptions,
  isProvinceLoading,
  isWardLoading,
  isLocating,
  isResolvingMapAddress,
  isSaving,
  onInputChange,
  onProvinceChange,
  onWardChange,
  onUseCurrentLocation,
  onPositionChange,
}: AddressBookFormFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <label className="order-1 block space-y-2">
        <span className="ml-1 block text-label-sm font-medium text-on-surface-variant">
          Tên người nhận
        </span>
        <input
          type="text"
          value={addressForm.recipientName}
          required
          maxLength={120}
          className="form-field__input pb-2 pt-2"
          onChange={(event) => onInputChange("recipientName", event.target.value)}
        />
      </label>

      <label className="order-2 block space-y-2">
        <span className="ml-1 block text-label-sm font-medium text-on-surface-variant">
          Số điện thoại người nhận
        </span>
        <input
          type="tel"
          value={addressForm.recipientPhone}
          required
          className="form-field__input pb-2 pt-2"
          onChange={(event) => onInputChange("recipientPhone", event.target.value)}
        />
      </label>

      <SearchableSelect
        id="address-province"
        label="Tỉnh / Thành phố"
        value={addressForm.provinceCode}
        options={provinceOptions}
        loading={isProvinceLoading}
        placeholder="Nhập để tìm kiếm tỉnh/thành"
        emptyText="Không tìm thấy tỉnh/thành."
        containerClassName="order-4"
        onChange={onProvinceChange}
      />

      <SearchableSelect
        id="address-ward"
        label="Phường / Xã"
        value={addressForm.wardCode}
        options={wardOptions}
        loading={isWardLoading}
        disabled={!addressForm.provinceCode}
        placeholder="Nhập để tìm kiếm phường/xã"
        emptyText="Không tìm thấy phường/xã."
        containerClassName="order-5"
        onChange={onWardChange}
      />

      <label className="order-6 block space-y-2 md:col-span-2">
        <span className="ml-1 block text-label-sm font-medium text-on-surface-variant">
          Địa chỉ cụ thể
        </span>
        <input
          type="text"
          value={addressForm.addressLine}
          minLength={2}
          required
          placeholder="Nhập số nhà, tên đường, tòa nhà..."
          className="form-field__input pb-2 pt-2"
          onChange={(event) => onInputChange("addressLine", event.target.value)}
        />
      </label>

      <div className="order-7 space-y-3 md:col-span-2">
        <button
          type="button"
          disabled={isLocating || isResolvingMapAddress || isSaving}
          onClick={onUseCurrentLocation}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-outline-variant/50 bg-surface px-3.5 py-2 text-sm font-semibold text-on-surface transition hover:border-primary/30 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLocating || isResolvingMapAddress ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <LocateFixed size={16} />
          )}
          {isLocating
            ? "Đang lấy vị trí hiện tại..."
            : isResolvingMapAddress
              ? "Đang xác định địa chỉ..."
              : "Định vị địa chỉ trên bản đồ"}
        </button>

        <LocationPickerMap
          latitude={addressForm.latitude}
          longitude={addressForm.longitude}
          disabled={Boolean(isSaving || isResolvingMapAddress)}
          isResolvingAddress={isResolvingMapAddress}
          onPositionChange={onPositionChange}
        />
      </div>

      <FloatingTextarea
        id="address-note"
        label="Ghi chú"
        value={addressForm.note || ""}
        rows={3}
        maxLength={200}
        containerClassName="order-8 md:col-span-2"
        onValueChange={(value) => onInputChange("note", value)}
      />
    </div>
  );
}
