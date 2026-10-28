import { useToastFeedback } from "@/components/common/Toast";
import { useRef, useState, type FormEvent } from "react";
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
  const [addressFormError, setAddressFormError] = useToastFeedback<string>("", "error");
  const [step, setStep] = useState<'details' | 'location'>('details');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const saving = useRef(false);

  const {
    provinceOptions,
    wardOptions,
    isProvinceLoading,
    isWardLoading,
    administrativeError,
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
    findAddressCoordinates,
    cancelLookup,
  } = useAddressGeocoding({ setAddressForm });

  const handleAddressInputChange = (
    field: keyof AddressFormState,
    value: string | boolean,
  ) => {
    if (field === 'addressLine') cancelLookup();
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
    cancelLookup();
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
  };

  const handleWardChange = (
    option: { value: number; label: string } | null,
  ) => {
    cancelLookup();
    setAddressForm((current) =>
      clearGeocodedFields({
        ...current,
        ward: option?.label || "",
        wardCode: option?.value,
      }),
    );
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

    if (step === 'details') {
      setStep('location');
      if (!Number.isFinite(addressForm.latitude) || !Number.isFinite(addressForm.longitude)) {
        void findAddressCoordinates(submission.payload);
      }
      return;
    }
    if (!Number.isFinite(addressForm.latitude) || !Number.isFinite(addressForm.longitude)
      || Math.abs(addressForm.latitude!) > 90 || Math.abs(addressForm.longitude!) > 180) {
      setAddressFormError("Vui lòng chọn vị trí ghim trên bản đồ trước khi xác nhận lưu địa chỉ.");
      return;
    }
    if (saving.current || isLocating || isResolvingMapAddress) return;

    saving.current = true;
    setIsSubmitting(true);
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
    } finally { saving.current = false; setIsSubmitting(false); }
  };

  return {
    addressForm,
    step,
    isSubmitting,
    backToDetails: () => { if (saving.current) return; cancelLookup(); setAddressFormError(''); setStep('details'); },
    retryLookup: () => {
      const submission = prepareAddressSubmission(addressForm);
      if (submission.payload) void findAddressCoordinates(submission.payload);
    },
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
