import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Modal } from "@/components/common/Modal";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/common/SearchableSelect";
import { FloatingTextarea } from "@/components/common/FloatingField";
import {
  getProvinces,
  getWardsByProvince,
  type AdministrativeUnit,
} from "@/features/customer/api/vietnamAddress.api";
import {
  mountPlaceAutocompleteElement,
  type ParsedPlaceAddress,
} from "@/features/customer/utils/googlePlacesAutocomplete";
import type {
  UserAddress,
  UserAddressPayload,
} from "@/features/profile/types/profile.types";

type AddressFormState = UserAddressPayload & {
  addressLine: string;
};

interface AddressBookModalProps {
  open: boolean;
  address?: UserAddress | null;
  addressCount: number;
  isSaving?: boolean;
  onClose: () => void;
  onSubmit: (
    payload: UserAddressPayload,
    address: UserAddress | null,
  ) => Promise<void> | void;
}

const EMPTY_ADDRESS_FORM: AddressFormState = {
  addressLine: "",
  fullAddress: "",
  province: "",
  provinceCode: undefined,
  ward: "",
  wardCode: undefined,
  note: "",
  isDefault: false,
};

const toSelectOptions = (
  items: AdministrativeUnit[],
): SearchableSelectOption[] =>
  items.map((item) => ({
    value: item.code,
    label: item.name,
    searchText: `${item.codeName} ${item.divisionType}`,
  }));

const composeFullAddress = (
  addressLine: string,
  ward: string,
  province: string,
) =>
  [addressLine, ward, province]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");

const extractAddressLine = (
  fullAddress: string,
  ward?: string,
  province?: string,
) => {
  const administrativeParts = [ward, province]
    .map((part) => part?.trim().toLowerCase())
    .filter(Boolean);

  return fullAddress
    .split(",")
    .map((part) => part.trim())
    .filter((part) => !administrativeParts.includes(part.toLowerCase()))
    .join(", ")
    .trim();
};

const toAddressForm = (
  address: UserAddress | null | undefined,
  addressCount: number,
): AddressFormState => {
  if (!address) {
    return {
      ...EMPTY_ADDRESS_FORM,
      isDefault: addressCount === 0,
    };
  }

  return {
    addressLine: extractAddressLine(
      address.fullAddress,
      address.ward,
      address.province,
    ),
    fullAddress: address.fullAddress,
    province: address.province,
    provinceCode: address.provinceCode,
    ward: address.ward,
    wardCode: address.wardCode,
    latitude: address.latitude,
    longitude: address.longitude,
    placeId: address.placeId,
    note: address.note || "",
    isDefault: Boolean(address.isDefault),
  };
};

const getErrorMessage = (error: unknown, fallback: string) => {
  const err = error as { response?: { data?: { message?: string } } };
  return err?.response?.data?.message || fallback;
};

export function AddressBookModal({
  open,
  address = null,
  addressCount,
  isSaving,
  onClose,
  onSubmit,
}: AddressBookModalProps) {
  const [addressForm, setAddressForm] = useState<AddressFormState>(() =>
    toAddressForm(address, addressCount),
  );
  const [addressFormError, setAddressFormError] = useState("");
  const [addressAutocompleteError, setAddressAutocompleteError] = useState("");
  const [administrativeError, setAdministrativeError] = useState("");
  const [provinces, setProvinces] = useState<AdministrativeUnit[]>([]);
  const [wards, setWards] = useState<AdministrativeUnit[]>([]);
  const [isProvinceLoading, setIsProvinceLoading] = useState(false);
  const [isWardLoading, setIsWardLoading] = useState(false);

  const addressAutocompleteContainerRef = useRef<HTMLDivElement>(null);
  const addressLineValueRef = useRef("");

  const provinceOptions = useMemo(
    () => toSelectOptions(provinces),
    [provinces],
  );
  const wardOptions = useMemo(() => toSelectOptions(wards), [wards]);

  useEffect(() => {
    addressLineValueRef.current = addressForm.addressLine;
  }, [addressForm.addressLine]);

  useEffect(() => {
    if (!open || provinces.length > 0) return undefined;

    let cancelled = false;

    const loadProvinces = async () => {
      try {
        setIsProvinceLoading(true);
        setAdministrativeError("");
        const data = await getProvinces();
        if (!cancelled) setProvinces(data);
      } catch {
        if (!cancelled) {
          setAdministrativeError("Không tải được danh sách tỉnh/thành.");
        }
      } finally {
        if (!cancelled) setIsProvinceLoading(false);
      }
    };

    void loadProvinces();
    return () => {
      cancelled = true;
    };
  }, [open, provinces.length]);

  useEffect(() => {
    if (!open || !addressForm.provinceCode) return undefined;

    let cancelled = false;

    const loadWards = async () => {
      try {
        setIsWardLoading(true);
        setAdministrativeError("");
        const data = await getWardsByProvince(
          addressForm.provinceCode as number,
        );
        if (!cancelled) setWards(data);
      } catch {
        if (!cancelled) {
          setAdministrativeError("Không tải được danh sách phường/xã.");
        }
      } finally {
        if (!cancelled) setIsWardLoading(false);
      }
    };

    void loadWards();
    return () => {
      cancelled = true;
    };
  }, [addressForm.provinceCode, open]);

  useEffect(() => {
    if (
      !open ||
      addressAutocompleteError ||
      !addressAutocompleteContainerRef.current
    ) {
      return undefined;
    }

    let cancelled = false;
    let detachAutocomplete: (() => void) | undefined;

    const handlePlaceInput = (value: string) => {
      setAddressForm((current) => {
        const next = {
          ...current,
          addressLine: extractAddressLine(
            value,
            current.ward,
            current.province,
          ),
        };
        delete next.latitude;
        delete next.longitude;
        delete next.placeId;
        return next;
      });
    };

    const handlePlaceSelect = (placeAddress: ParsedPlaceAddress) => {
      setAddressForm((current) => ({
        ...current,
        addressLine: extractAddressLine(
          placeAddress.fullAddress || current.addressLine,
          current.ward,
          current.province,
        ),
        latitude: placeAddress.latitude,
        longitude: placeAddress.longitude,
        placeId: placeAddress.placeId,
      }));
    };

    const contextParts = [addressForm.ward, addressForm.province]
      .map((part) => part.trim())
      .filter(Boolean);

    void mountPlaceAutocompleteElement({
      container: addressAutocompleteContainerRef.current,
      value: addressLineValueRef.current,
      placeholder: contextParts.length
        ? `Nhập số nhà, tên đường, ${contextParts.join(", ")}`
        : "Nhập số nhà, tên đường",
      onInput: handlePlaceInput,
      onPlaceSelect: handlePlaceSelect,
    })
      .then((detach) => {
        if (cancelled) {
          detach();
        } else {
          detachAutocomplete = detach;
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAddressAutocompleteError(
            "Google Places chưa sẵn sàng. Bạn vẫn có thể nhập địa chỉ thủ công.",
          );
        }
      });

    return () => {
      cancelled = true;
      detachAutocomplete?.();
    };
  }, [addressAutocompleteError, addressForm.province, addressForm.ward, open]);

  const handleAddressInputChange = (
    field: keyof AddressFormState,
    value: string | boolean,
  ) => {
    setAddressForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "addressLine") {
        delete next.latitude;
        delete next.longitude;
        delete next.placeId;
      }
      return next;
    });
  };

  const handleProvinceChange = (option: SearchableSelectOption | null) => {
    setAddressForm((current) => ({
      ...current,
      province: option?.label || "",
      provinceCode: option?.value,
      ward: "",
      wardCode: undefined,
    }));
    setWards([]);
  };

  const handleWardChange = (option: SearchableSelectOption | null) => {
    setAddressForm((current) => ({
      ...current,
      ward: option?.label || "",
      wardCode: option?.value,
    }));
  };

  const getCurrentPlacesInputValue = () => {
    const element = addressAutocompleteContainerRef.current?.querySelector(
      ".google-place-autocomplete",
    ) as { value?: string } | null;

    return element?.value?.trim() || "";
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAddressFormError("");

    const currentAddressLine =
      addressForm.addressLine.trim() ||
      extractAddressLine(
        getCurrentPlacesInputValue(),
        addressForm.ward,
        addressForm.province,
      );

    if (
      !currentAddressLine ||
      !addressForm.province.trim() ||
      !addressForm.ward.trim()
    ) {
      setAddressFormError(
        "Vui lòng nhập đầy đủ địa chỉ cụ thể, tỉnh/thành và phường/xã.",
      );
      return;
    }

    const payload: UserAddressPayload = {
      fullAddress: composeFullAddress(
        currentAddressLine,
        addressForm.ward,
        addressForm.province,
      ),
      province: addressForm.province,
      provinceCode: addressForm.provinceCode,
      ward: addressForm.ward,
      wardCode: addressForm.wardCode,
      latitude: addressForm.latitude,
      longitude: addressForm.longitude,
      placeId: addressForm.placeId,
      note: addressForm.note,
      isDefault: addressForm.isDefault,
    };

    try {
      await onSubmit(payload, address);
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

  return (
    <Modal
      open={open}
      title={address ? "Cập nhật địa chỉ" : "Thêm địa chỉ mới"}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {(addressFormError || administrativeError) && (
          <div className="rounded-2xl bg-error/10 p-3 text-sm text-error">
            {addressFormError || administrativeError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SearchableSelect
            id="address-province"
            label="Tỉnh /Thành phố"
            value={addressForm.provinceCode}
            options={provinceOptions}
            loading={isProvinceLoading}
            placeholder="Nhập để tìm kiếm tỉnh/thành"
            emptyText="Không tìm thấy tỉnh/thành."
            containerClassName="order-1"
            onChange={handleProvinceChange}
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
            containerClassName="order-2"
            onChange={handleWardChange}
          />

          <div className="order-3 space-y-2 md:col-span-2">
            <label
              htmlFor="address-line-google-places"
              className="ml-1 block text-label-sm font-medium text-on-surface-variant"
            >
              Địa chỉ cụ thể
            </label>
            {addressAutocompleteError ? (
              <input
                id="address-line-google-places"
                type="text"
                value={addressForm.addressLine}
                minLength={2}
                required
                placeholder="Nhập số nhà, tên đường"
                className="form-field__input pb-2 pt-2"
                onChange={(event) =>
                  handleAddressInputChange("addressLine", event.target.value)
                }
              />
            ) : (
              <div
                ref={addressAutocompleteContainerRef}
                className="google-place-autocomplete-shell"
              />
            )}
            <p
              className={`px-1 text-xs ${
                addressAutocompleteError
                  ? "text-error"
                  : "text-on-surface-variant"
              }`}
            >
              {addressAutocompleteError ||
                "Google Places sẽ gợi ý địa chỉ tại Việt Nam. Tỉnh/thành và phường/xã vẫn lấy từ dropdown đã chọn."}
            </p>
          </div>

          <FloatingTextarea
            id="address-note"
            label="Ghi chú"
            value={addressForm.note || ""}
            rows={3}
            maxLength={200}
            containerClassName="order-4 md:col-span-2"
            onValueChange={(value) => handleAddressInputChange("note", value)}
          />
        </div>

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
