import { isAxiosError } from "axios";
import { bookingApi } from "@/features/booking/api/booking.api";
import { isValidCoordinate } from "@/features/tracking/components/order-tracking-map/geo-helpers";
import type { Coordinate } from "@/features/tracking/components/order-tracking-map/types";

export const resolveProviderWorkingAddress = async (coordinate: Coordinate, isCurrent = () => true) => {
  // Chỉ tra điểm lân cận khi nguồn bản đồ không tìm được địa chỉ tại tọa độ GPS.
  const nearbyDelta = 150 / 111_320;
  const candidates = [coordinate,
    { latitude: coordinate.latitude + nearbyDelta, longitude: coordinate.longitude },
    { latitude: coordinate.latitude, longitude: coordinate.longitude + nearbyDelta / Math.cos(coordinate.latitude * Math.PI / 180) },
  ].filter(isValidCoordinate);
  for (const [index, candidate] of candidates.entries()) {
    if (!isCurrent()) return null;
    try {
      const result = await bookingApi.reverseGeocode(candidate.latitude, candidate.longitude);
      const address = result.fullAddress.trim() || [result.ward, result.province].filter(Boolean).join(", ");
      if (address) return { address, nearby: index > 0, attribution: result.attribution };
    } catch (error) {
      if (!isAxiosError(error) || error.response?.status !== 422) throw error;
    }
  }
  throw new Error("Chưa tìm được địa chỉ tại vị trí GPS hoặc khu vực gần đó. Vui lòng thử lại.");
};
