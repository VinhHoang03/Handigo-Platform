import { useState } from "react";
import type { NavigateFunction } from "react-router-dom";
import { bookingApi } from "@/features/booking/api/booking.api";
import { useAuthStore } from "@/features/auth/store/auth.store";
import type { Address, Service } from "@/types/booking";
import {
  type CurrentLocationDraft,
  findExistingCurrentLocation,
} from "./addressLocationUtils";
import { getErrorMessage } from "./serviceDetailErrors";
import { resolveRecipientContact } from "./resolveRecipientContact";

interface UseCurrentLocationPickerParams {
  service: Service | null;
  addresses: Address[];
  isAuthenticated: boolean;
  navigate: NavigateFunction;
  onAddresses: (addresses: Address[]) => void;
  onSelectAddress: (addressId: string) => void;
  onError: (message: string) => void;
  onRequiresPhoneUpdate: (value: boolean) => void;
}

/** Luồng "dùng vị trí hiện tại": định vị, ghim tọa độ và lưu thành địa chỉ. */
export function useCurrentLocationPicker({
  service,
  addresses,
  isAuthenticated,
  navigate,
  onAddresses,
  onSelectAddress,
  onError,
  onRequiresPhoneUpdate,
}: UseCurrentLocationPickerParams) {
  const user = useAuthStore((state) => state.user);
  const [isLocating, setIsLocating] = useState(false);
  const [currentLocationDraft, setCurrentLocationDraft] =
    useState<CurrentLocationDraft | null>(null);
  const [currentLocationError, setCurrentLocationError] = useState("");
  const [isResolvingCurrentAddress, setIsResolvingCurrentAddress] = useState(false);
  const [isSavingCurrentLocation, setIsSavingCurrentLocation] = useState(false);

  const useCurrentLocation = () => {
    onError("");
    onRequiresPhoneUpdate(false);
    if (!service) return;

    if (!navigator.geolocation) {
      onError("Trình duyệt không hỗ trợ định vị hiện tại.");
      return;
    }
    if (!isAuthenticated) {
      navigate("/login", { state: { from: `/customer/services/${service._id}` } });
      return;
    }

    const contact = resolveRecipientContact(user, addresses);
    if (!contact) {
      onRequiresPhoneUpdate(true);
      onError(
        "Vui lòng cập nhật số điện thoại Việt Nam hợp lệ trước khi dùng vị trí hiện tại.",
      );
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const { fullAddress, ward, province, latitude, longitude, placeId } =
            await bookingApi.reverseGeocode(coords.latitude, coords.longitude);
          setCurrentLocationDraft({
            ...contact,
            fullAddress,
            ward,
            province,
            latitude,
            longitude,
            placeId,
          });
          setCurrentLocationError("");
        } catch (createError) {
          onError(
            getErrorMessage(createError, "Không thể lưu vị trí hiện tại. Vui lòng thử lại."),
          );
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        onError("Không thể lấy vị trí hiện tại. Vui lòng kiểm tra quyền định vị.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  };

  const handlePositionChange = async (latitude: number, longitude: number) => {
    if (!currentLocationDraft) return;

    setCurrentLocationError("");
    setIsResolvingCurrentAddress(true);
    try {
      const currentAddress = await bookingApi.reverseGeocode(latitude, longitude);
      setCurrentLocationDraft((current) =>
        current
          ? {
              ...current,
              fullAddress: currentAddress.fullAddress,
              province: currentAddress.province,
              ward: currentAddress.ward,
              latitude: currentAddress.latitude,
              longitude: currentAddress.longitude,
              placeId: currentAddress.placeId,
            }
          : null,
      );
    } catch (resolveError) {
      setCurrentLocationDraft((current) =>
        current ? { ...current, latitude, longitude, placeId: undefined } : null,
      );
      setCurrentLocationError(
        getErrorMessage(
          resolveError,
          "Đã ghim tọa độ nhưng không thể xác định địa chỉ tại vị trí này. Vui lòng thử vị trí khác.",
        ),
      );
    } finally {
      setIsResolvingCurrentAddress(false);
    }
  };

  const handleConfirm = async () => {
    if (!currentLocationDraft) return;

    setCurrentLocationError("");
    setIsSavingCurrentLocation(true);
    try {
      const existingAddress = findExistingCurrentLocation(addresses, currentLocationDraft);
      if (existingAddress) {
        onSelectAddress(existingAddress._id);
        setCurrentLocationDraft(null);
        return;
      }

      const createdAddress = await bookingApi.createAddress({
        ...currentLocationDraft,
        isDefault: false,
      });
      onAddresses([
        createdAddress,
        ...addresses.filter((address) => address._id !== createdAddress._id),
      ]);
      onSelectAddress(createdAddress._id);
      setCurrentLocationDraft(null);
    } catch (createError) {
      setCurrentLocationError(
        getErrorMessage(createError, "Không thể lưu vị trí đã chọn. Vui lòng thử lại."),
      );
    } finally {
      setIsSavingCurrentLocation(false);
    }
  };

  return {
    isLocating,
    currentLocationDraft,
    currentLocationError,
    isResolvingCurrentAddress,
    isSavingCurrentLocation,
    useCurrentLocation,
    handlePositionChange,
    handleConfirm,
    closeDraft: () => setCurrentLocationDraft(null),
  };
}
