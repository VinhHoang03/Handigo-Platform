import { useState, type FormEvent } from "react";
import type { UserAddress, UserAddressPayload } from "@/features/profile/types/profile.types";
import { getErrorMessage } from "@/utils/apiError";
import {
  clearGeocodedFields,
  prepareAddressSubmission,
  toAddressForm,
  type AddressDefaultRecipient,
  type AddressFormState,
} from "@/features/profile/utils/addressBookForm.utils";
import { useAddressAdministrativeUnits } from "./useAddressAdministrativeUnits";
import { useAddressGeocoding } from "./useAddressGeocoding";

interface UseAddressBookFormOptions {
  open: boolean;
  address: UserAddress | null;
  addressCount: number;
  defaultRecipient: AddressDefaultRecipient;
  onSubmit: (
    payload: UserAddressPayload,
    address: UserAddress | null,
  ) => Promise<void> | void;
  onClose: () => void;
}

/** Toàn bộ state + hành vi của form địa chỉ: nhập tay, chọn tỉnh/phường, ghim bản đồ, submit. */
export function useAddressBookForm({
  open,
  address,
  addressCount,
  defaultRecipient,
  onSubmit,
  onClose,
}: UseAddressBookFormOptions) {
  const [addressForm, setAddressForm] = useState<AddressFormState>(() =>
    toAddressForm(address, addressCount, defaultRecipient),
  );
  const [addressFormError, setAddressFormError] = useState("");

  const {
    provinces,
    provinceOptions,
    wardOptions,
    isProvinceLoading,
    isWardLoading,
    administrativeError,
    setProvinces,
    setWards,
  } = useAddressAdministrativeUnits({
    open,
    province: addressForm.province,
    provinceCode: addressForm.provinceCode,
    ward: addressForm.ward,
    wardCode: addressForm.wardCode,
    setAddressForm,
  });

  const {
    locationError,
    locationHint,
    isLocating,
    isResolvingMapAddress,
    handleUseCurrentLocation: startCurrentLocationLookup,
    updateAddressFromCoordinate,
    setLocationHint,
  } = useAddressGeocoding({ provinces, setProvinces, setWards, setAddressForm });

  const handleAddressInputChange = (
    field: keyof AddressFormState,
    value: string | boolean,
  ) => {
    setAddressForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "addressLine") {
        return clearGeocodedFields(next);
      }
      return next;
    });
  };

  const handleProvinceChange = (
    option: { value: number; label: string } | null,
  ) => {
    setAddressForm((current) =>
      clearGeocodedFields({
        ...current,
        province: option?.label || "",
        provinceCode: option?.value,
        ward: "",
        wardCode: undefined,
      }),
    );
    setWards([]);
    setLocationHint("");
  };

  const handleWardChange = (
    option: { value: number; label: string } | null,
  ) => {
    setAddressForm((current) =>
      clearGeocodedFields({
        ...current,
        ward: option?.label || "",
        wardCode: option?.value,
      }),
    );
    setLocationHint("");
  };

  const handleUseCurrentLocation = () => {
    startCurrentLocationLookup(() => setAddressFormError(""));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAddressFormError("");

    const submission = prepareAddressSubmission(addressForm);
    if (!submission.payload) {
      setAddressFormError(submission.error);
      return;
    }

    try {
      await onSubmit(submission.payload, address);
      onClose();
    } catch (submitError) {
      setAddressFormError(
        getErrorMessage(
          submitError,
          "Không thể lưu địa chỉ. Vui lòng thử lại.",
        ),
      );
    }
  };

  return {
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
  };
}
