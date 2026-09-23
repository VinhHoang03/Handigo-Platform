import { useEffect, useState } from "react";
import type { Category, Service, ServiceOption } from "@/types/booking";
import { customerServiceApi } from "../api/customerService.api";
import { getCategoryId } from "../utils/serviceDisplay";
import { getErrorMessage } from "./serviceDetailErrors";

/** Tải dịch vụ, danh mục, tùy chọn và dịch vụ liên quan theo `serviceId`. */
export function useServiceDetailData(serviceId: string | undefined) {
  const [service, setService] = useState<Service | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [options, setOptions] = useState<ServiceOption[]>([]);
  const [relatedServices, setRelatedServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDetail = async () => {
      if (!serviceId) return;
      setIsLoading(true);
      setError("");
      try {
        const [serviceData, categoryData, optionData] = await Promise.all([
          customerServiceApi.serviceById(serviceId),
          customerServiceApi.categories(),
          customerServiceApi.options(serviceId),
        ]);
        setService(serviceData);
        setCategories(categoryData);
        setOptions(optionData);

        const categoryId = getCategoryId(serviceData);
        if (categoryId) {
          const related = await customerServiceApi.services({
            categoryId,
            limit: 4,
          });
          setRelatedServices(
            related.items.filter((item) => item._id !== serviceData._id).slice(0, 3),
          );
        }
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      } finally {
        setIsLoading(false);
      }
    };

    void loadDetail();
  }, [serviceId]);

  return { service, categories, options, relatedServices, isLoading, error };
}
