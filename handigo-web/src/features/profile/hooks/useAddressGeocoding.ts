import { useToastFeedback } from "@/components/common/Toast";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { bookingApi } from "@/features/booking/api/booking.api";
import type { UserAddressPayload } from "../types/profile.types";
import type { AddressFormState } from "../utils/addressBookForm.utils";

const validCoordinates = (latitude?: number, longitude?: number) =>
  Number.isFinite(latitude) && Number.isFinite(longitude)
  && Math.abs(latitude!) <= 90 && Math.abs(longitude!) <= 180;

/** Tra vị trí từ địa chỉ hoặc ghim của khách; luôn giữ nguyên phần địa chỉ đã nhập. */
export function useAddressGeocoding({ setAddressForm }: {
  setAddressForm: Dispatch<SetStateAction<AddressFormState>>;
}) {
  const [locationError, setLocationError] = useToastFeedback<string>("", "error");
  const [locationHint, setLocationHint] = useToastFeedback<string>("", "success");
  const [isLocating, setIsLocating] = useState(false);
  const [isResolvingMapAddress, setIsResolvingMapAddress] = useState(false);
  const sequence = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const cancelLookup = () => {
    sequence.current++;
    setIsLocating(false);
    setIsResolvingMapAddress(false);
    setLocationError("");
    setLocationHint("");
  };

  const findAddressCoordinates = async (address: Pick<UserAddressPayload, "fullAddress" | "province" | "ward">) => {
    const request = ++sequence.current;
    setLocationError("");
    setLocationHint("");
    setIsLocating(false);
    setIsResolvingMapAddress(true);
    try {
      const result = await bookingApi.geocodeAddress(address);
      if (!alive.current || request !== sequence.current) return;
      if (!validCoordinates(result.latitude, result.longitude)) throw new Error("Vị trí gợi ý chưa hợp lệ.");
      setAddressForm(current => ({ ...current, latitude: result.latitude, longitude: result.longitude, placeId: result.placeId }));
      setLocationHint("Đã tìm vị trí gợi ý theo địa chỉ hoặc phường/xã đã chọn. Kiểm tra ghim và kéo chỉnh nếu cần, rồi xác nhận để lưu.");
    } catch {
      if (alive.current && request === sequence.current) {
        setLocationError("Chưa tìm được vị trí phù hợp. Địa chỉ đã nhập được giữ nguyên; bạn có thể kéo bản đồ để chọn ghim.");
      }
    } finally {
      if (alive.current && request === sequence.current) setIsResolvingMapAddress(false);
    }
  };

  const updateAddressFromCoordinate = (latitude: number, longitude: number) => {
    cancelLookup();
    if (!validCoordinates(latitude, longitude)) {
      setLocationError("Vị trí ghim không hợp lệ. Vui lòng chọn lại.");
      return;
    }
    setAddressForm(current => ({ ...current, latitude, longitude, placeId: undefined }));
    setLocationHint("Đã chọn vị trí ghim. Địa chỉ bạn nhập được giữ nguyên; xác nhận để lưu.");
  };

  const handleUseCurrentLocation = (onStart: () => void) => {
    cancelLookup();
    onStart();
    if (!navigator.geolocation) {
      setLocationError("Trình duyệt không hỗ trợ định vị. Bạn có thể kéo bản đồ để chọn ghim.");
      return;
    }
    const request = sequence.current;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (!alive.current || request !== sequence.current) return;
      updateAddressFromCoordinate(coords.latitude, coords.longitude);
    }, () => {
      if (!alive.current || request !== sequence.current) return;
      setLocationError("Chưa lấy được vị trí hiện tại. Bạn có thể kéo bản đồ để chọn ghim.");
      setIsLocating(false);
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
  };

  return {
    locationError, locationHint, isLocating, isResolvingMapAddress,
    handleUseCurrentLocation, updateAddressFromCoordinate, findAddressCoordinates, cancelLookup,
  };
}
