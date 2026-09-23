import type {
  AdministrativeUnit,
} from "@/features/customer/api/vietnamAddress.api";
import type {
  UserAddress,
  UserAddressPayload,
} from "@/features/profile/types/profile.types";
import type { SearchableSelectOption } from "@/components/common/SearchableSelect";
import {
  isValidVietnamesePhone,
  normalizeVietnamesePhone,
} from "@/utils/phoneValidation";
import {
  composeFullAddress,
  extractAddressLine,
  normalizeAddressPart,
} from "./addressLineParsing.utils";

export type AddressFormState = UserAddressPayload & {
  addressLine: string;
};

export interface AddressDefaultRecipient {
  name: string;
  phone: string;
}

export const EMPTY_ADDRESS_FORM: AddressFormState = {
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

export const toSelectOptions = (
  items: AdministrativeUnit[],
): SearchableSelectOption[] =>
  items.map((item) => ({
    value: item.code,
    label: item.name,
    searchText: `${item.codeName} ${item.divisionType}`,
  }));

const normalizeAdministrativeUnitName = (value: string) =>
  normalizeAddressPart(value)
    .replace(/[.,_-]/g, " ")
    .replace(/\s+/g, " ")
    .replace(
      /^(tinh|thanh pho|tp|phuong|xa|thi tran|đac khu|dac khu)\s+/,
      "",
    )
    .trim();

export const findAdministrativeUnitByName = (
  items: AdministrativeUnit[],
  target: string,
) => {
  const normalizedTarget = normalizeAdministrativeUnitName(target);
  if (!normalizedTarget) return undefined;

  return items.find((item) => {
    const normalizedName = normalizeAdministrativeUnitName(item.name);
    const normalizedCodeName = normalizeAdministrativeUnitName(item.codeName);
    return (
      normalizedName === normalizedTarget ||
      normalizedCodeName === normalizedTarget ||
      normalizedName.includes(normalizedTarget) ||
      normalizedTarget.includes(normalizedName)
    );
  });
};

export const clearGeocodedFields = (
  form: AddressFormState,
): AddressFormState => {
  const next = { ...form };
  delete next.latitude;
  delete next.longitude;
  delete next.placeId;
  return next;
};

export const toAddressForm = (
  address: UserAddress | null | undefined,
  addressCount: number,
  defaultRecipient: AddressDefaultRecipient,
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

/**
 * Kiểm tra hợp lệ và dựng payload gửi lên API từ form địa chỉ.
 * Trả về thông báo lỗi (để hiển thị) hoặc payload sẵn sàng gửi đi.
 */
export const prepareAddressSubmission = (
  form: AddressFormState,
): { error: string; payload?: never } | { error?: never; payload: UserAddressPayload } => {
  const currentAddressLine = form.addressLine.trim();

  if (
    !form.recipientName.trim() ||
    !form.recipientPhone.trim() ||
    !currentAddressLine ||
    !form.province.trim() ||
    !form.ward.trim()
  ) {
    return {
      error:
        "Vui lòng nhập đầy đủ người nhận, số điện thoại và thông tin địa chỉ.",
    };
  }

  const normalizedRecipientName = form.recipientName.trim().replace(/\s+/g, " ");
  const normalizedRecipientPhone = normalizeVietnamesePhone(form.recipientPhone);

  if (!/^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u.test(normalizedRecipientName)) {
    return { error: "Tên người nhận chỉ được chứa chữ cái và khoảng trắng." };
  }

  if (!isValidVietnamesePhone(normalizedRecipientPhone)) {
    return { error: "Số điện thoại người nhận không hợp lệ." };
  }

  return {
    payload: {
      recipientName: normalizedRecipientName,
      recipientPhone: normalizedRecipientPhone,
      fullAddress: composeFullAddress(currentAddressLine, form.ward, form.province),
      province: form.province,
      provinceCode: form.provinceCode,
      ward: form.ward,
      wardCode: form.wardCode,
      latitude: form.latitude,
      longitude: form.longitude,
      placeId: form.placeId,
      note: form.note,
      isDefault: form.isDefault,
    },
  };
};
