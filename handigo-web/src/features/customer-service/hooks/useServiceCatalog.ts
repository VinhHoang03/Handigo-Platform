import { useEffect, useMemo, useState } from "react";
import { customerServiceApi } from "../api/customerService.api";
import {
  getCategoryId,
  getServicePriceLabel,
  getServiceSortValue,
} from "../utils/serviceDisplay";
import type { Category, Service } from "@/types/booking";

export type ServiceSortKey = "name" | "price_asc";

const getErrorMessage = (error: unknown) => {
  const err = error as { response?: { data?: { message?: string } } };
  return err?.response?.data?.message || "Không thể tải danh sách dịch vụ.";
};

/** Bỏ dấu để "dieu hoa" cũng khớp "điều hoà": người dùng ít khi gõ dấu. */
const foldAccents = (value?: string | null) =>
  (value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

interface UseServiceCatalogArgs {
  selectedCategoryId: string;
  search: string;
  sortBy: ServiceSortKey;
}

/**
 * Tải và lọc danh mục dịch vụ cho trang danh sách.
 *
 * Tìm kiếm chạy trên tên + mô tả dịch vụ + tên danh mục, tất cả đã nằm sẵn trong
 * bộ nhớ. Trước đây trang còn nạp tuỳ chọn của **mọi** dịch vụ để tìm cả trong
 * tên tuỳ chọn: gõ một ký tự là bắn 16 lời gọi `/services/:id/options` cùng lúc.
 * Đánh đổi: gõ "50 mét vuông" không còn ra kết quả. Muốn tìm theo tuỳ chọn thì
 * phải làm phía server, một lời gọi, không phải 16.
 */
export function useServiceCatalog({
  selectedCategoryId,
  search,
  sortBy,
}: UseServiceCatalogArgs) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setError("");
      try {
        const [categoryData, serviceData] = await Promise.all([
          customerServiceApi.categories(),
          customerServiceApi.services(),
        ]);
        if (!active) return;
        setCategories(categoryData);
        setServices(serviceData.items);
      } catch (loadError) {
        if (active) setError(getErrorMessage(loadError));
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  /** Số dịch vụ theo từng danh mục, để sidebar ẩn được danh mục rỗng. */
  const serviceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const service of services) {
      const id = getCategoryId(service);
      if (id) counts[id] = (counts[id] || 0) + 1;
    }
    return counts;
  }, [services]);

  const visibleServices = useMemo(() => {
    const keyword = foldAccents(search);

    const filtered = services.filter((service) => {
      if (selectedCategoryId && getCategoryId(service) !== selectedCategoryId) {
        return false;
      }
      if (!keyword) return true;

      const category = categories.find(
        (item) => item._id === getCategoryId(service),
      );
      return foldAccents(
        [service.name, service.description, category?.name].join(" "),
      ).includes(keyword);
    });

    if (sortBy === "name") {
      return [...filtered].sort((left, right) =>
        left.name.localeCompare(right.name, "vi"),
      );
    }

    // Dịch vụ chỉ báo giá sau khảo sát không có giá để so, nên xếp xuống cuối
    // thay vì lẫn vào giữa bằng số tiền cọc của nó.
    return [...filtered].sort((left, right) => {
      const leftQuote = getServicePriceLabel(left).kind === "quote";
      const rightQuote = getServicePriceLabel(right).kind === "quote";
      if (leftQuote !== rightQuote) return leftQuote ? 1 : -1;
      if (leftQuote) return left.name.localeCompare(right.name, "vi");
      return getServiceSortValue(left) - getServiceSortValue(right);
    });
  }, [categories, search, selectedCategoryId, services, sortBy]);

  return {
    categories,
    services,
    serviceCounts,
    visibleServices,
    isLoading,
    error,
  };
}
