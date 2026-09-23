import type { Address } from "@/types/booking";

/** Helpers thuần cho việc chọn "vị trí hiện tại" và hiển thị nhãn địa chỉ. */

export const CURRENT_LOCATION_VALUE = "__current_location__";
export const CURRENT_LOCATION_DUPLICATE_RADIUS_METERS = 50;

export interface CurrentLocationDraft {
  recipientName: string;
  recipientPhone: string;
  fullAddress: string;
  province: string;
  ward: string;
  latitude: number;
  longitude: number;
  placeId?: string;
}

const getDistanceMeters = (
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) => {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(latitudeA)) *
      Math.cos(toRadians(latitudeB)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const findExistingCurrentLocation = (
  addresses: Address[],
  currentAddress: {
    latitude: number;
    longitude: number;
    placeId?: string;
  },
) =>
  addresses.find((address) => {
    if (currentAddress.placeId && address.placeId === currentAddress.placeId) {
      return true;
    }

    if (
      typeof address.latitude !== "number" ||
      typeof address.longitude !== "number" ||
      !Number.isFinite(address.latitude) ||
      !Number.isFinite(address.longitude)
    ) {
      return false;
    }

    return (
      getDistanceMeters(
        address.latitude,
        address.longitude,
        currentAddress.latitude,
        currentAddress.longitude,
      ) <= CURRENT_LOCATION_DUPLICATE_RADIUS_METERS
    );
  });

export const formatAddressLabel = (address: Address) =>
  address.fullAddress ||
  [address.detailAddress, address.ward, address.district, address.province]
    .filter(Boolean)
    .join(", ") ||
  "Địa chỉ đã lưu";
