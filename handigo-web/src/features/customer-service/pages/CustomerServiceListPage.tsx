import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CustomerServiceLayout } from "../components/CustomerServiceLayout";
import { customerServiceApi } from "../api/customerService.api";
import {
  getCategoryId,
  getCategoryName,
  getServiceImage,
  getServicePrice,
  money,
} from "../utils/serviceDisplay";
import { ReliableImage } from "@/components/common/ReliableImage";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import type { Category, Service, ServiceOption } from "@/types/booking";

const getErrorMessage = (error: unknown) => {
  const err = error as { response?: { data?: { message?: string } } };
  return err?.response?.data?.message || "Không thể tải danh sách dịch vụ.";
};

export default function CustomerServiceListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [optionMap, setOptionMap] = useState<Record<string, ServiceOption[]>>(
    {},
  );
  const selectedCategoryId = searchParams.get("categoryId") || "";
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [sortBy, setSortBy] = useState("popular");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const requestedOptionIdsRef = useRef(new Set<string>());

  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      setError("");
      try {
        const [categoryData, serviceData] = await Promise.all([
          customerServiceApi.categories(),
          customerServiceApi.services(),
        ]);
        setCategories(categoryData);
        setServices(serviceData.items);
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      } finally {
        setIsLoading(false);
      }
    };

    void loadInitialData();
  }, []);

  useEffect(() => {
    if (!search.trim() || services.length === 0) return undefined;

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      const missingServices = services.filter(
        (service) => !requestedOptionIdsRef.current.has(service._id),
      );
      if (missingServices.length === 0) return;

      missingServices.forEach((service) =>
        requestedOptionIdsRef.current.add(service._id),
      );

      void Promise.all(
        missingServices.map(async (service) => {
          try {
            return [
              service._id,
              await customerServiceApi.options(service._id),
            ] as const;
          } catch {
            return [service._id, []] as const;
          }
        }),
      ).then((entries) => {
        if (cancelled) return;
        setOptionMap((current) => ({
          ...current,
          ...Object.fromEntries(entries),
        }));
      });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [search, services]);

  const handleCategoryChange = (categoryId: string) => {
    if (categoryId) {
      setSearchParams({ categoryId });
      return;
    }
    setSearchParams({});
  };

  const visibleServices = useMemo(() => {
    const normalizeText = (value?: string | null) =>
      (value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");
    const keyword = normalizeText(search);
    const filtered = services.filter((service) => {
      const matchCategory =
        !selectedCategoryId || getCategoryId(service) === selectedCategoryId;
      const category = categories.find(
        (item) => item._id === getCategoryId(service),
      );
      const searchableText = [
        service.name,
        service.description,
        category?.name,
        category?.description,
        ...(optionMap[service._id] || []).flatMap((option) => [
          option.name,
          option.description,
        ]),
      ]
        .map(normalizeText)
        .join(" ");
      const matchSearch = !keyword || searchableText.includes(keyword);
      return matchCategory && matchSearch;
    });

    return [...filtered].sort((left, right) => {
      if (sortBy === "price_asc") {
        return getServicePrice(left) - getServicePrice(right);
      }
      if (sortBy === "name") return left.name.localeCompare(right.name, "vi");
      return 0;
    });
  }, [categories, optionMap, search, selectedCategoryId, services, sortBy]);

  const selectedCategory = categories.find(
    (category) => category._id === selectedCategoryId,
  );

  return (
    <CustomerServiceLayout>
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-4">
        <aside className="md:sticky md:top-32 md:col-span-1 md:self-start">
          <div className="rounded-xl border border-outline-variant/30 bg-white p-5 shadow-sm md:max-h-[calc(100vh-9rem)] md:overflow-y-auto">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-on-surface">Bộ lọc</h2>
              <span className="material-symbols-outlined text-on-surface-variant">
                tune
              </span>
            </div>

            <div className="space-y-2">
              <p className="mb-3 text-xs font-bold uppercase text-outline">
                Danh mục
              </p>
              <button
                type="button"
                onClick={() => handleCategoryChange("")}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold ${
                  !selectedCategoryId
                    ? "bg-primary text-on-primary"
                    : "text-on-surface hover:bg-surface-container-low"
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">
                  apps
                </span>
                Tất cả dịch vụ
              </button>
              {categories.map((category) => {
                const categoryImage = category.image;

                return (
                  <button
                    key={category._id}
                    type="button"
                    onClick={() => handleCategoryChange(category._id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold ${
                      selectedCategoryId === category._id
                        ? "bg-primary text-on-primary"
                        : "text-on-surface hover:bg-surface-container-low"
                    }`}
                  >
                    {categoryImage ? (
                      <ReliableImage
                        src={categoryImage.replace(
                          /^http:\/\/res\.cloudinary\.com/i,
                          "https://res.cloudinary.com",
                        )}
                        alt={category.name}
                        loading="lazy"
                        decoding="async"
                        className="h-5 w-5 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <CategoryIcon
                        icon={category.icon}
                        name={category.name}
                        className="h-5 w-5 shrink-0"
                      />
                    )}
                    {category.name}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="md:col-span-3">
          <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-bold uppercase text-primary">
                Dịch vụ Handigo
              </p>
              <h1 className="mt-2 text-3xl font-bold text-on-surface">
                {selectedCategory?.name || "Danh sách dịch vụ"}
              </h1>
              <p className="mt-1 text-on-surface-variant">
                Hiển thị {visibleServices.length} dịch vụ phù hợp
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-64">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
                  search
                </span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm kiếm dịch vụ..."
                  className="min-h-11 w-full rounded-full border border-outline-variant/40 bg-white pl-10 pr-4 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </div>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="min-h-11 rounded-full border border-outline-variant/40 bg-white px-4 text-sm font-semibold text-primary"
              >
                <option value="popular">Phổ biến nhất</option>
                <option value="price_asc">Giá thấp đến cao</option>
                <option value="name">Tên A-Z</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-error/10 px-4 py-3 text-error">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="rounded-xl bg-white p-8 text-center text-on-surface-variant">
              Đang tải danh sách dịch vụ...
            </div>
          ) : visibleServices.length === 0 ? (
            <div className="rounded-xl border border-dashed border-outline-variant bg-white p-8 text-center text-on-surface-variant">
              Chưa có dịch vụ phù hợp.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              {visibleServices.map((service, index) => {
                const price = getServicePrice(service);
                const isQuoteOnly = price <= 0;
                return (
                  <Link
                    key={service._id}
                    to={`/customer/services/${service._id}`}
                    className="group overflow-hidden rounded-2xl border border-outline-variant/20 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                  >
                    <div className="relative h-48 overflow-hidden">
                      <ReliableImage
                        src={getServiceImage(service, index)}
                        alt={service.name}
                        loading={index < 3 ? "eager" : "lazy"}
                        decoding="async"
                        fetchPriority={index < 3 ? "high" : "auto"}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <span className="absolute left-4 top-4 rounded-full bg-primary-container/90 px-3 py-1 text-xs font-bold uppercase text-white">
                        {getCategoryName(service, categories)}
                      </span>
                    </div>
                    <div className="p-5">
                      <h3 className="line-clamp-2 text-xl font-bold leading-tight text-on-surface transition-colors group-hover:text-primary">
                        {service.name}
                      </h3>
                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-outline-variant/30 pt-4">
                        <div>
                          {!isQuoteOnly && (
                            <span className="block text-xs text-outline">
                              {service.serviceType === "fixed_price"
                                ? "Giá"
                                : "Từ"}
                            </span>
                          )}
                          <span className="text-lg font-bold text-primary">
                            {isQuoteOnly ? "Báo giá" : money.format(price)}
                          </span>
                        </div>
                        <span className="rounded-lg bg-primary/10 px-4 py-2 text-sm font-bold text-primary transition group-hover:bg-primary group-hover:text-on-primary">
                          Xem chi tiết
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </CustomerServiceLayout>
  );
}
