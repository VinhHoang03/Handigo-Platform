import { useMemo } from "react";
import type { Service, ServiceOption } from "@/types/booking";
import { getOptionPrice, getServicePrice } from "../utils/serviceDisplay";

/** Tính giá tạm tính dựa trên dịch vụ và các tùy chọn đã chọn. */
export function useServicePricing(
  service: Service | null,
  options: ServiceOption[],
  selectedOptionIds: string[],
  selectedOptionQuantities: Record<string, number>,
) {
  const selectedOptions = options.filter((option) =>
    selectedOptionIds.includes(option._id),
  );

  const basePrice = service ? getServicePrice(service) : 0;
  const selectedOptionTotal = selectedOptions.reduce(
    (total, option) =>
      total + getOptionPrice(option) * (selectedOptionQuantities[option._id] ?? 1),
    0,
  );

  const estimatePrice = useMemo(() => {
    if (!service) return 0;
    if (service.serviceType === "fixed_price") {
      return selectedOptionTotal;
    }
    return basePrice;
  }, [basePrice, selectedOptionTotal, service]);

  return { estimatePrice };
}
