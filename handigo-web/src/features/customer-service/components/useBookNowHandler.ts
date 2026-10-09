import type { NavigateFunction } from "react-router-dom";
import { isAirConditionerCleaning } from '@/utils/airConditionerCleaning';
import type { Address, Service, ServiceOption } from "@/types/booking";
import { getCategoryId } from "../utils/serviceDisplay";
import { isRequiredOptionSelectionMissing } from "@/features/booking/utils/serviceOptionSelection";

interface UseBookNowHandlerParams {
  options: ServiceOption[];
  service: Service | null;
  isAuthenticated: boolean;
  navigate: NavigateFunction;
  addressId: string | undefined;
  addresses: Address[];
  selectedOptionIds: string[];
  selectedOptionQuantities: Record<string, number>;
  uniformQuantity: number;
  setAddressSelectionError: (message: string) => void;
  setOptionSelectionError: (message: string) => void;
  selectService: (
    categoryId: string,
    serviceId: string,
    optionIds: string[],
    optionQuantities: Record<string, number>,
    uniformQuantity?: number,
  ) => void;
}

/** Xác thực điều kiện đặt lịch (đăng nhập, địa chỉ, thợ, tùy chọn) rồi điều hướng sang bước chọn lịch. */
export function useBookNowHandler({
  options,
  service,
  isAuthenticated,
  navigate,
  addressId,
  addresses,
  selectedOptionIds,
  selectedOptionQuantities,
  uniformQuantity,
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
    if (isRequiredOptionSelectionMissing(service, selectedOptionIds, options)) {
      setOptionSelectionError("Vui lòng chọn đủ các nhóm tùy chọn bắt buộc.");
      return;
    }

    if (isAirConditionerCleaning(service) && options.length === 0 && !(service.fixedPrice && service.fixedPrice > 0)) {
      setOptionSelectionError("Dịch vụ chưa có giá hợp lệ. Vui lòng thử lại sau.");
      return;
    }
    selectService(getCategoryId(service), service._id,
      isAirConditionerCleaning(service) && options.length === 0 ? [] : selectedOptionIds,
      isAirConditionerCleaning(service) && options.length === 0 ? {} : selectedOptionQuantities, uniformQuantity);
    navigate("/customer/bookings/new/location", {
      state: { fromServiceDetail: true },
    });
  };
}
