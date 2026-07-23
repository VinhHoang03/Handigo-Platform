import { useEffect, useState } from "react";
import type { NavigateFunction } from "react-router-dom";
import { bookingApi } from "@/features/booking/api/booking.api";
import type { Address, Service } from "@/types/booking";
import { CURRENT_LOCATION_VALUE } from "./addressLocationUtils";
import { useCurrentLocationPicker } from "./useCurrentLocationPicker";

interface UseAddressSelectionParams {
  service: Service | null;
  addressId: string | undefined;
  setAddressId: (id: string) => void;
  isAuthenticated: boolean;
  isAuthInitializing: boolean;
  navigate: NavigateFunction;
  onAddressChanged: () => void;
}

/** Địa chỉ đã lưu + luồng "vị trí hiện tại" cho panel đặt lịch. */
export function useAddressSelection({
  service,
  addressId,
  setAddressId,
  isAuthenticated,
  isAuthInitializing,
  navigate,
  onAddressChanged,
}: UseAddressSelectionParams) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);
  const [addressSelectionError, setAddressSelectionError] = useState("");
  const [requiresPhoneUpdate, setRequiresPhoneUpdate] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadAddresses = async () => {
      if (isAuthInitializing) return;

      if (!isAuthenticated) {
        setAddresses([]);
        setAddressSelectionError("");
        setIsLoadingAddresses(false);
        return;
      }

      setIsLoadingAddresses(true);
      setAddressSelectionError("");
      try {
        const data = await bookingApi.getAddresses();
        if (!isMounted) return;

        setAddresses(data);
      } catch {
        if (isMounted) {
          setAddresses([]);
          setAddressSelectionError("Không tải được danh sách địa chỉ đã lưu.");
        }
      } finally {
        if (isMounted) setIsLoadingAddresses(false);
      }
    };

    void loadAddresses();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, isAuthInitializing]);

  useEffect(() => {
    if (isAuthInitializing || isLoadingAddresses) return;
    if (addresses.some((address) => address._id === addressId)) return;

    const nextAddress = addresses.find((address) => address.isDefault) || addresses[0];
    setAddressId(nextAddress?._id || "");
  }, [addressId, addresses, isAuthInitializing, isLoadingAddresses, setAddressId]);

  const currentLocation = useCurrentLocationPicker({
    service,
    addresses,
    isAuthenticated,
    navigate,
    onAddresses: setAddresses,
    onSelectAddress: setAddressId,
    onError: setAddressSelectionError,
    onRequiresPhoneUpdate: setRequiresPhoneUpdate,
  });

  const handleAddressChange = (value: string) => {
    if (value === CURRENT_LOCATION_VALUE) {
      currentLocation.useCurrentLocation();
      return;
    }
    setAddressSelectionError("");
    onAddressChanged();
    setAddressId(value);
  };

  return {
    addresses,
    isLoadingAddresses,
    addressSelectionError,
    setAddressSelectionError,
    requiresPhoneUpdate,
    handleAddressChange,
    ...currentLocation,
  };
}
