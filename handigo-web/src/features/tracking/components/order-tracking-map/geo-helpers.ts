import type { Address, Order } from "@/types/booking";
import type { Coordinate } from "./types";

export const canShareLiveLocation = (status: Order["status"]) =>
  status === "accepted" || status === "in_progress";

export const getOrderAddress = (order: Order) =>
  typeof order.addressId === "object" && order.addressId
    ? (order.addressId as Address)
    : null;

export const getAddressLine = (address: Address | null) => {
  if (!address) return "";
  return (
    address.fullAddress?.trim() ||
    [address.detailAddress, address.ward, address.district, address.province]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(", ")
  );
};

export const isValidCoordinate = (coordinate: Coordinate | null | undefined) =>
  Boolean(
    coordinate &&
    Number.isFinite(coordinate.latitude) &&
    coordinate.latitude >= -90 &&
    coordinate.latitude <= 90 &&
    Number.isFinite(coordinate.longitude) &&
    coordinate.longitude >= -180 &&
    coordinate.longitude <= 180,
  );

export const getAddressCoordinate = (address: Address | null): Coordinate | null => {
  if (!address) return null;
  const coordinate = {
    latitude: Number(address.latitude),
    longitude: Number(address.longitude),
  };
  return isValidCoordinate(coordinate) ? coordinate : null;
};

/**
 * Geocode một địa chỉ văn bản qua Nominatim (OpenStreetMap) — không cần API key.
 * Trả về toạ độ hoặc null nếu không tìm thấy.
 */
export const geocodeAddressViaNominatim = async (
  fullAddress: string,
): Promise<Coordinate | null> => {
  if (!fullAddress.trim()) return null;
  try {
    const query = encodeURIComponent(fullAddress + ", Việt Nam");
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=vn`;
    const response = await fetch(url, {
      headers: { "Accept-Language": "vi", "User-Agent": "Handigo-App/1.0" },
    });
    if (!response.ok) return null;
    const results = (await response.json()) as Array<{ lat: string; lon: string }>;
    if (!results.length) return null;
    const coordinate = {
      latitude: parseFloat(results[0].lat),
      longitude: parseFloat(results[0].lon),
    };
    return isValidCoordinate(coordinate) ? coordinate : null;
  } catch {
    return null;
  }
};

export const formatCoordinate = (coordinate: Coordinate) =>
  coordinate.latitude.toFixed(5) + ", " + coordinate.longitude.toFixed(5);

export const formatUpdatedAt = (value?: string) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

export const haversineDistanceInMeters = (from: Coordinate, to: Coordinate) => {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const formatDistance = (meters: number) =>
  meters >= 1000 ? (meters / 1000).toFixed(1) + " km" : Math.round(meters) + " m";

export const hasGeolocationSupport = () =>
  typeof navigator !== "undefined" && "geolocation" in navigator;

export const toLatLng = (c: Coordinate): [number, number] => [c.latitude, c.longitude];
