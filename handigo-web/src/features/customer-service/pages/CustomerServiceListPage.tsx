import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CustomerServiceLayout } from "../components/CustomerServiceLayout";
import { ServiceCategoryFilter } from "../components/ServiceCategoryFilter";
import { ServiceListToolbar } from "../components/ServiceListToolbar";
import { ServiceCard } from "../components/ServiceCard";
import { ServiceListSkeleton } from "../components/ServiceListSkeleton";
import { AsyncState } from "@/components/common/AsyncState";
import { customerServiceApi } from "../api/customerService.api";
import { getCategoryId, getServicePrice } from "../utils/serviceDisplay";
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
        <ServiceCategoryFilter
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onSelect={handleCategoryChange}
        />

        <section className="md:col-span-3">
          <ServiceListToolbar
            title={selectedCategory?.name || "Danh sách dịch vụ"}
            resultCount={visibleServices.length}
            search={search}
            onSearchChange={setSearch}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />

          {error && (
            <div className="mb-4 rounded-lg bg-error/10 px-4 py-3 text-error">
              {error}
            </div>
          )}

          <AsyncState
            loading={isLoading}
            empty={visibleServices.length === 0}
            emptyMessage="Chưa có dịch vụ phù hợp."
            skeleton={<ServiceListSkeleton />}
          >
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              {visibleServices.map((service, index) => (
                <ServiceCard
                  key={service._id}
                  service={service}
                  index={index}
                  categories={categories}
                />
              ))}
            </div>
          </AsyncState>
        </section>
      </div>
    </CustomerServiceLayout>
  );
}
