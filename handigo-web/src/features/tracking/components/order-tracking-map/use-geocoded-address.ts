import { useEffect, useState } from "react";
import type { Address } from "@/types/booking";
import { geocodeAddressViaNominatim } from "./geo-helpers";
import type { Coordinate } from "./types";

/**
 * Tự động geocode địa chỉ qua Nominatim khi address thiếu toạ độ trong DB.
 */
export function useGeocodedAddress(
  address: Address | null,
  savedCustomerCoordinate: Coordinate | null,
) {
  const [geocodedCoordinate, setGeocodedCoordinate] = useState<Coordinate | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  useEffect(() => {
    if (savedCustomerCoordinate) return; // Đã có toạ độ từ DB → không cần geocode
    const fullAddress = address?.fullAddress?.trim();
    if (!fullAddress) return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsGeocoding(true);
    geocodeAddressViaNominatim(fullAddress).then((result) => {
      if (!cancelled) {
        setGeocodedCoordinate(result);
        setIsGeocoding(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [address?.fullAddress, savedCustomerCoordinate]);

  return { geocodedCoordinate, isGeocoding };
}
