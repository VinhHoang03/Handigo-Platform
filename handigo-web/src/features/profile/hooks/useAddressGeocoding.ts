import {
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { bookingApi } from "@/features/booking/api/booking.api";
import {
  getProvinces,
  getWardsByProvince,
  type AdministrativeUnit,
} from "@/features/customer/api/vietnamAddress.api";
import {
  findAdministrativeUnitByName,
  type AddressFormState,
} from "@/features/profile/utils/addressBookForm.utils";
import { extractStreetAddressLine } from "@/features/profile/utils/addressLineParsing.utils";
import { getErrorMessage } from "@/utils/apiError";

interface UseAddressGeocodingOptions {
  provinces: AdministrativeUnit[];
  setProvinces: Dispatch<SetStateAction<AdministrativeUnit[]>>;
  setWards: Dispatch<SetStateAction<AdministrativeUnit[]>>;
  setAddressForm: Dispatch<SetStateAction<AddressFormState>>;
}

/** Ghim vị trí trên bản đồ / định vị hiện tại rồi suy ra tỉnh/thành, phường/xã tương ứng. */
export function useAddressGeocoding({
  provinces,
  setProvinces,
  setWards,
  setAddressForm,
}: UseAddressGeocodingOptions) {
  const [locationError, setLocationError] = useState("");
  const [locationHint, setLocationHint] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [isResolvingMapAddress, setIsResolvingMapAddress] = useState(false);
  const mapRequestSequenceRef = useRef(0);

  const applyResolvedAddress = async (
    currentAddress: Awaited<ReturnType<typeof bookingApi.reverseGeocode>>,
  ) => {
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
  };

  const updateAddressFromCoordinate = async (
    latitude: number,
    longitude: number,
    successMessage: string,
  ) => {
    const requestSequence = ++mapRequestSequenceRef.current;
    setLocationError("");
    setIsResolvingMapAddress(true);

    try {
      const currentAddress = await bookingApi.reverseGeocode(
        latitude,
        longitude,
      );
      if (requestSequence !== mapRequestSequenceRef.current) return;

      await applyResolvedAddress(currentAddress);
      if (requestSequence !== mapRequestSequenceRef.current) return;
      setLocationHint(successMessage);
    } catch (error) {
      if (requestSequence !== mapRequestSequenceRef.current) return;
      setAddressForm((current) => ({
        ...current,
        latitude,
        longitude,
        placeId: undefined,
      }));
      setLocationError(
        getErrorMessage(
          error,
          "Đã ghim tọa độ nhưng không thể xác định địa chỉ tại vị trí này. Vui lòng kiểm tra lại địa chỉ trước khi lưu.",
        ),
      );
    } finally {
      if (requestSequence === mapRequestSequenceRef.current) {
        setIsResolvingMapAddress(false);
      }
    }
  };

  const handleUseCurrentLocation = (onStart: () => void) => {
    onStart();
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
          await updateAddressFromCoordinate(
            coords.latitude,
            coords.longitude,
            "Đã điền địa chỉ từ vị trí hiện tại. Kéo bản đồ nếu bạn muốn chỉnh ghim chính xác hơn.",
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

  return {
    locationError,
    locationHint,
    isLocating,
    isResolvingMapAddress,
    handleUseCurrentLocation,
    updateAddressFromCoordinate,
    setLocationHint,
  };
}
