import type { UserAddress } from "@/features/profile/types/profile.types";

/**
 * Ghi chú mặc định do backend tự sinh khi tạo địa chỉ từ vị trí hiện tại lúc
 * đặt dịch vụ. Không hiển thị ghi chú này cho người dùng vì nó không có ý nghĩa
 * mô tả (khác với ghi chú người dùng tự nhập).
 */
export const CURRENT_LOCATION_LEGACY_NOTE =
  "Địa chỉ được tạo từ vị trí hiện tại khi đặt dịch vụ.";

const extractAddressTitle = (address: UserAddress) => {
  const segments = address.fullAddress
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!segments.length) return "";

  const [streetSegment] = segments;
  const secondSegment = segments[1];
  const isWardSegment =
    Boolean(secondSegment) &&
    Boolean(address.ward) &&
    secondSegment.localeCompare(address.ward, "vi", {
      sensitivity: "accent",
    }) === 0;

  return isWardSegment ? streetSegment : segments.slice(0, 2).join(" ");
};

export const getAddressDisplay = (address: UserAddress) =>
  [extractAddressTitle(address), address.ward, address.province]
    .filter(Boolean)
    .join(", ");

export const getVisibleAddressNote = (address: UserAddress) => {
  const note = address.note?.trim();
  return note === CURRENT_LOCATION_LEGACY_NOTE ? "" : note || "";
};

export const getAddressTitle = (address: UserAddress) =>
  getVisibleAddressNote(address) ||
  getAddressDisplay(address) ||
  [address.ward, address.province].filter(Boolean).join(", ") ||
  "Địa chỉ";
