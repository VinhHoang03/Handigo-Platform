import { useEffect, useState } from "react";
import { customerServiceApi } from "@/features/customer-service/api/customerService.api";
import type { Category, Service } from "@/types/booking";

export interface CategoryShowcaseItem {
  id: string;
  name: string;
  icon?: string;
  iconColor?: string | null;
  /** Số dịch vụ đang mở trong danh mục. Đếm từ API, không phải số ước lượng. */
  serviceCount: number;
}

const categoryIdOf = (service: Service) => {
  const category = service.categoryId as unknown;
  if (typeof category === "string") return category;
  if (category && typeof category === "object" && "_id" in category) {
    return String((category as { _id: unknown })._id);
  }
  return "";
};

/**
 * Gộp danh mục với dịch vụ để hiển thị tên, biểu tượng, màu và số dịch vụ.
 *
 * Chỉ trả về danh mục **đang có dịch vụ**. Danh mục rỗng vẫn tồn tại trong DB
 * nhưng bấm vào chỉ dẫn tới trang trắng — đưa lên trang chủ là hứa suông.
 */
export function useCategoryShowcase() {
  const [items, setItems] = useState<CategoryShowcaseItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    Promise.all([
      customerServiceApi.categories(),
      customerServiceApi.services({ limit: 100 }),
    ])
      .then(([categories, serviceList]: [Category[], { items: Service[] }]) => {
        if (!active) return;
        const services = serviceList.items ?? [];
        const showcase = categories
          .map<CategoryShowcaseItem>((category) => {
            const owned = services.filter(
              (service) => categoryIdOf(service) === category._id,
            );
            return {
              id: category._id,
              name: category.name,
              icon: category.icon,
              iconColor: category.iconColor,
              serviceCount: owned.length,
            };
          })
          .filter((item) => item.serviceCount > 0)
          .sort((a, b) => b.serviceCount - a.serviceCount);

        setItems(showcase);
      })
      .catch(() => {
        if (active) setItems([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { items, loading };
}
