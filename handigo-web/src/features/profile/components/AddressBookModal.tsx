import { useEffect, useMemo, useState, type FormEvent } from "react";
import { MapPin, RefreshCw } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/common/SearchableSelect";
import { FloatingTextarea } from "@/components/common/FloatingField";
import { bookingApi } from "@/features/booking/api/booking.api";
import {
  getProvinces,
  getWardsByProvince,
  type AdministrativeUnit,
} from "@/features/customer/api/vietnamAddress.api";
import type {
  UserAddress,
  UserAddressPayload,
} from "@/features/profile/types/profile.types";
import { getErrorMessage } from "@/utils/apiError";
import {
  isValidVietnamesePhone,
  normalizeVietnamesePhone,
} from "@/utils/phoneValidation";

type AddressFormState = UserAddressPayload & {
  addressLine: string;
};

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

const EMPTY_ADDRESS_FORM: AddressFormState = {
  recipientName: "",
  recipientPhone: "",
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

const normalizeAddressPart = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const composeFullAddress = (
  addressLine: string,
  ward: string,
  province: string,
) => {
  const parts = [addressLine.trim()];
  const normalizedAddressLine = normalizeAddressPart(addressLine);

  [ward, province]
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      if (!normalizedAddressLine.includes(normalizeAddressPart(part))) {
        parts.push(part);
      }
    });

  return parts.filter(Boolean).join(", ");
};

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

const extractStreetAddressLine = (
  fullAddress: string,
  ward?: string,
  province?: string,
) => {
  const segments = fullAddress
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!segments.length) return "";

  const normalizedWard = normalizeAddressPart(ward || "");
  const normalizedProvince = normalizeAddressPart(province || "");
  const streetParts: string[] = [];

  for (const segment of segments) {
    const normalizedSegment = normalizeAddressPart(segment);
    const isAdministrativeSegment =
      normalizedSegment === normalizedWard ||
      normalizedSegment === normalizedProvince ||
      normalizedSegment.includes("viet nam") ||
      normalizedSegment.includes("vietnam") ||
      /\b\d{5,6}\b/.test(segment);

    if (isAdministrativeSegment) break;
    streetParts.push(segment);
  }

  return extractAddressLine(streetParts.join(" "), ward, province);
};

const findAdministrativeUnitByName = (
  items: AdministrativeUnit[],
  target: string,
) => {
  const normalizedTarget = normalizeAddressPart(target);
  if (!normalizedTarget) return undefined;

  return items.find((item) => {
    const normalizedName = normalizeAddressPart(item.name);
    const normalizedCodeName = normalizeAddressPart(item.codeName);
    return (
      normalizedName === normalizedTarget ||
      normalizedCodeName === normalizedTarget ||
      normalizedName.includes(normalizedTarget) ||
      normalizedTarget.includes(normalizedName)
    );
  });
};

const clearGeocodedFields = (form: AddressFormState): AddressFormState => {
  const next = { ...form };
  delete next.latitude;
  delete next.longitude;
  delete next.placeId;
  return next;
};

const toAddressForm = (
  address: UserAddress | null | undefined,
  addressCount: number,
  defaultRecipient: AddressBookModalProps["defaultRecipient"],
): AddressFormState => {
  if (!address) {
    return {
      ...EMPTY_ADDRESS_FORM,
      recipientName: defaultRecipient.name,
      recipientPhone: defaultRecipient.phone,
      isDefault: addressCount === 0,
    };
  }

  return {
    recipientName: address.recipientName || defaultRecipient.name,
    recipientPhone: address.recipientPhone || defaultRecipient.phone,
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

export function AddressBookModal({
  open,
  address = null,
  addressCount,
  isSaving,
  defaultRecipient,
  onClose,
  onSubmit,
}: AddressBookModalProps) {
  const [addressForm, setAddressForm] = useState<AddressFormState>(() =>
    toAddressForm(address, addressCount, defaultRecipient),
  );
  const [addressFormError, setAddressFormError] = useState("");
  const [administrativeError, setAdministrativeError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [locationHint, setLocationHint] = useState("");
  const [provinces, setProvinces] = useState<AdministrativeUnit[]>([]);
  const [wards, setWards] = useState<AdministrativeUnit[]>([]);
  const [isProvinceLoading, setIsProvinceLoading] = useState(false);
  const [isWardLoading, setIsWardLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const provinceOptions = useMemo(
    () => toSelectOptions(provinces),
    [provinces],
  );
  const wardOptions = useMemo(() => toSelectOptions(wards), [wards]);

  useEffect(() => {
    if (!open || provinces.length > 0) return undefined;

    let cancelled = false;

    const loadProvinces = async () => {
      try {
        setIsProvinceLoading(true);
        setAdministrativeError("");
        const data = await getProvinces();
        if (!cancelled) {
          setProvinces(data);

          if (addressForm.province && !addressForm.provinceCode) {
            const matchedProvince = findAdministrativeUnitByName(
              data,
              addressForm.province,
            );
            if (matchedProvince) {
              setAddressForm((current) => ({
                ...current,
                province: matchedProvince.name,
                provinceCode: matchedProvince.code,
              }));
            }
          }
        }
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
  }, [addressForm.province, addressForm.provinceCode, open, provinces.length]);

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
        if (!cancelled) {
          setWards(data);

          if (addressForm.ward && !addressForm.wardCode) {
            const matchedWard = findAdministrativeUnitByName(
              data,
              addressForm.ward,
            );
            if (matchedWard) {
              setAddressForm((current) => ({
                ...current,
                ward: matchedWard.name,
                wardCode: matchedWard.code,
              }));
            }
          }
        }
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
  }, [addressForm.provinceCode, addressForm.ward, addressForm.wardCode, open]);

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

  const handleProvinceChange = (option: SearchableSelectOption | null) => {
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

  const handleWardChange = (option: SearchableSelectOption | null) => {
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
    setAddressFormError("");
    setLocationError("");
    setLocationHint("");

    if (!navigator.geolocation) {
      setLocationError("Trình duyệt không hỗ trợ định vị hiện tại.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const currentAddress = await bookingApi.reverseGeocode(
            coords.latitude,
            coords.longitude,
          );

          const provinceSource =
            provinces.length > 0 ? provinces : await getProvinces();
          if (provinces.length === 0) {
            setProvinces(provinceSource);
          }

          const matchedProvince = findAdministrativeUnitByName(
            provinceSource,
            currentAddress.province,
          );
          const wardSource = matchedProvince
            ? await getWardsByProvince(matchedProvince.code)
            : [];
          const matchedWard = findAdministrativeUnitByName(
            wardSource,
            currentAddress.ward,
          );

          setAddressForm((current) => ({
            ...current,
            addressLine: extractStreetAddressLine(
              currentAddress.fullAddress,
              currentAddress.ward,
              currentAddress.province,
            ),
            fullAddress: currentAddress.fullAddress,
            province: matchedProvince?.name || currentAddress.province,
            provinceCode: matchedProvince?.code,
            ward: matchedWard?.name || currentAddress.ward,
            wardCode: matchedWard?.code,
            latitude: currentAddress.latitude,
            longitude: currentAddress.longitude,
            placeId: currentAddress.placeId,
          }));

          setWards(wardSource);
          setLocationHint(
            "Đã điền địa chỉ từ vị trí hiện tại. Bạn có thể kiểm tra và chỉnh lại các ô nếu cần.",
          );
        } catch (error) {
          setLocationError(
            getErrorMessage(
              error,
              "Không thể lấy địa chỉ từ vị trí hiện tại. Vui lòng thử lại.",
            ),
          );
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        setLocationError(
          "Không thể lấy vị trí hiện tại. Vui lòng kiểm tra quyền định vị.",
        );
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAddressFormError("");

    const currentAddressLine = addressForm.addressLine.trim();

    if (
      !addressForm.recipientName.trim() ||
      !addressForm.recipientPhone.trim() ||
      !currentAddressLine ||
      !addressForm.province.trim() ||
      !addressForm.ward.trim()
    ) {
      setAddressFormError(
        "Vui lòng nhập đầy đủ người nhận, số điện thoại và thông tin địa chỉ.",
      );
      return;
    }

    const normalizedRecipientPhone = normalizeVietnamesePhone(
      addressForm.recipientPhone,
    );

    if (
      !/^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u.test(
        addressForm.recipientName.trim().replace(/\s+/g, " "),
      )
    ) {
      setAddressFormError(
        "Tên người nhận chỉ được chứa chữ cái và khoảng trắng.",
      );
      return;
    }

    if (!isValidVietnamesePhone(normalizedRecipientPhone)) {
      setAddressFormError("Số điện thoại người nhận không hợp lệ.");
      return;
    }

    const payload: UserAddressPayload = {
      recipientName: addressForm.recipientName.trim().replace(/\s+/g, " "),
      recipientPhone: normalizedRecipientPhone,
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
              onChange={(event) =>
                handleAddressInputChange("recipientName", event.target.value)
              }
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
              onChange={(event) =>
                handleAddressInputChange("recipientPhone", event.target.value)
              }
            />
          </label>

          <div className="order-3 md:col-span-2">
            <button
              type="button"
              disabled={isLocating || isSaving}
              onClick={handleUseCurrentLocation}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLocating ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <MapPin size={16} />
              )}
              {isLocating
                ? "Đang lấy vị trí hiện tại..."
                : "Dùng vị trí hiện tại"}
            </button>
            <p className="mt-2 px-1 text-xs text-on-surface-variant">
              Hệ thống sẽ tự điền địa chỉ từ vị trí hiện tại.
            </p>
          </div>

          <SearchableSelect
            id="address-province"
            label="Tỉnh / Thành phố"
            value={addressForm.provinceCode}
            options={provinceOptions}
            loading={isProvinceLoading}
            placeholder="Nhập để tìm kiếm tỉnh/thành"
            emptyText="Không tìm thấy tỉnh/thành."
            containerClassName="order-4"
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
            containerClassName="order-5"
            onChange={handleWardChange}
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
              onChange={(event) =>
                handleAddressInputChange("addressLine", event.target.value)
              }
            />
          </label>

          <FloatingTextarea
            id="address-note"
            label="Ghi chú"
            value={addressForm.note || ""}
            rows={3}
            maxLength={200}
            containerClassName="order-7 md:col-span-2"
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
