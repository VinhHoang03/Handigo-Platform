import { useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "@/utils/apiError";
import { providerApplicationApi } from "../api/providerApplication.api";
import type { Category } from "../types/providerApplication.types";

/**
 * Nạp danh mục/dịch vụ khả dụng cho đơn bổ sung dịch vụ và lọc ra những dịch
 * vụ chưa có trong hồ sơ hiện tại. Tách khỏi `ServiceAdditionApplicationDialog`
 * để giữ file dưới 200 dòng — hành vi giữ nguyên 100% so với bản gốc.
 */
export function useServiceAdditionCategories(
  open: boolean,
  currentServiceIds: string[],
  setError: (message: string) => void,
) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    let active = true;
    providerApplicationApi
      .categories()
      .then((items) => {
        if (active) setCategories(items);
      })
      .catch((loadError) => {
        if (active) {
          setError(getErrorMessage(loadError, "Không thể tải danh sách dịch vụ."));
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, setError]);

  const selectableCategories = useMemo(
    () =>
      categories
        .map((category) => ({
          ...category,
          services: (category.services || []).filter(
            (service) => !currentServiceIds.includes(service._id),
          ),
        }))
        .filter((category) => (category.services || []).length > 0),
    [categories, currentServiceIds],
  );

  return { selectableCategories, isLoading };
}
