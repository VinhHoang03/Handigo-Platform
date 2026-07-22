import type { NavigateFunction } from "react-router-dom";
import type { Address, Service } from "@/types/booking";
import type { ProviderAvailabilityStatus } from "./NearbyProviderSelector";
import { getCategoryId } from "../utils/serviceDisplay";
import { isRequiredOptionSelectionMissing } from "@/features/booking/utils/serviceOptionSelection";

interface UseBookNowHandlerParams {
  service: Service | null;
  isAuthenticated: boolean;
  navigate: NavigateFunction;
  addressId: string | undefined;
  addresses: Address[];
  providerAvailability: ProviderAvailabilityStatus;
  selectedOptionIds: string[];
  selectedOptionQuantities: Record<string, number>;
  setAddressSelectionError: (message: string) => void;
  setOptionSelectionError: (message: string) => void;
  selectService: (
    categoryId: string,
    serviceId: string,
    optionIds: string[],
    optionQuantities: Record<string, number>,
  ) => void;
}

/** Xác thực điều kiện đặt lịch (đăng nhập, địa chỉ, chuyên gia, tùy chọn) rồi điều hướng sang bước chọn lịch. */
export function useBookNowHandler({
  service,
  isAuthenticated,
  navigate,
  addressId,
  addresses,
  providerAvailability,
  selectedOptionIds,
  selectedOptionQuantities,
  setAddressSelectionError,
  setOptionSelectionError,
  selectService,
}: UseBookNowHandlerParams) {
  return () => {
    if (!service) return;
    if (!isAuthenticated) {
      navigate("/login", { state: { from: `/customer/services/${service._id}` } });
      return;
    }
    if (!addressId || !addresses.some((address) => address._id === addressId)) {
      setAddressSelectionError("Vui lòng chọn địa chỉ thực hiện trước khi đặt lịch.");
      return;
    }
    if (providerAvailability !== "available") {
      setAddressSelectionError(
        providerAvailability === "loading" || providerAvailability === "idle"
          ? "Vui lòng chờ hệ thống kiểm tra chuyên gia phù hợp."
          : "Chưa có chuyên gia phù hợp với dịch vụ và địa chỉ đã chọn.",
      );
      return;
    }
    if (isRequiredOptionSelectionMissing(service, selectedOptionIds)) {
      setOptionSelectionError("Vui lòng chọn ít nhất một tùy chọn dịch vụ.");
      return;
    }

    selectService(getCategoryId(service), service._id, selectedOptionIds, selectedOptionQuantities);
    navigate("/customer/bookings/new/location", {
      state: { fromServiceDetail: true },
    });
  };
}
