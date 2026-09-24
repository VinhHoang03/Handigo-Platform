import { useMemo } from "react";
import type { Service, ServiceOption } from "@/types/booking";
import { getOptionPrice } from "../utils/serviceDisplay";

/**
 * Tính giá tạm tính dựa trên dịch vụ và các tùy chọn đã chọn.
 *
 * Với `variable_price`, hàm trả **0** chứ không trả tiền cọc. Trước đây nó trả
 * `depositAmount`, nên thanh đặt lịch in "Giá tạm tính 20.000 đ" ngay phía trên
 * dòng "Báo giá sau khảo sát": hai câu mâu thuẫn nhau, và con số đó là tiền
 * cọc chứ không phải giá. Trả 0 để `BookingSidebar` đi vào đúng nhánh sẵn có
 * của nó là hiện "Báo giá sau khảo sát".
 *
 * Đây chỉ là số để **hiển thị**: khi tạo đơn, client không gửi trường tiền nào
 * lên server (`CreateOrderPayload`), backend tự dựng snapshot giá từ bản ghi
 * dịch vụ trong DB. Tiền cọc vẫn được thu đúng.
 */
export function useServicePricing(
  service: Service | null,
  options: ServiceOption[],
  selectedOptionIds: string[],
  selectedOptionQuantities: Record<string, number>,
) {
  const selectedOptions = options.filter((option) =>
    selectedOptionIds.includes(option._id),
  );

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
    return 0;
  }, [selectedOptionTotal, service]);

  return { estimatePrice };
}
