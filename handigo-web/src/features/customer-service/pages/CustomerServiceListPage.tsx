import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CustomerServiceLayout } from "../components/CustomerServiceLayout";
import { ServiceCategoryFilter } from "../components/ServiceCategoryFilter";
import { ServiceFilterSheet } from "../components/ServiceFilterSheet";
import { ServiceListToolbar } from "../components/ServiceListToolbar";
import { ServiceListEmpty } from "../components/ServiceListEmpty";
import { ServiceCard } from "../components/ServiceCard";
import { ServiceListSkeleton } from "../components/ServiceListSkeleton";
import {
  useServiceCatalog,
  type ServiceSortKey,
} from "../hooks/useServiceCatalog";

export default function CustomerServiceListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCategoryId = searchParams.get("categoryId") || "";
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [sortBy, setSortBy] = useState<ServiceSortKey>("name");
  const [isFilterSheetOpen, setFilterSheetOpen] = useState(false);

  const {
    categories,
    services,
    serviceCounts,
    visibleServices,
    isLoading,
    error,
  } = useServiceCatalog({ selectedCategoryId, search, sortBy });

  const selectCategory = (categoryId: string) =>
    setSearchParams(categoryId ? { categoryId } : {});

  const selectedCategory = categories.find(
    (category) => category._id === selectedCategoryId,
  );

  return (
    <CustomerServiceLayout>
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-4">
        {/* Sidebar chỉ tồn tại từ `md` trở lên. Ở màn hình hẹp, bộ lọc nằm trong
            tấm trượt mở từ toolbar để không chắn mất danh sách dịch vụ. */}
        <div className="hidden md:col-span-1 md:block">
          <ServiceCategoryFilter
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelect={selectCategory}
            serviceCounts={serviceCounts}
            totalCount={services.length}
          />
        </div>

        <section className="md:col-span-3">
          <ServiceListToolbar
            title={selectedCategory?.name || "Danh sách dịch vụ"}
            resultCount={visibleServices.length}
            search={search}
            onSearchChange={setSearch}
            sortBy={sortBy}
            onSortChange={setSortBy}
            activeFilterCount={selectedCategoryId ? 1 : 0}
            onOpenFilters={() => setFilterSheetOpen(true)}
            isLoading={isLoading}
          />

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg bg-error/10 px-4 py-3 text-error"
            >
              {error}
            </div>
          )}

          {isLoading ? (
            <ServiceListSkeleton />
          ) : visibleServices.length ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visibleServices.map((service, index) => (
                <ServiceCard
                  key={service._id}
                  service={service}
                  index={index}
                  categories={categories}
                />
              ))}
            </div>
          ) : (
            <ServiceListEmpty
              search={search}
              categoryName={selectedCategory?.name}
              onClearSearch={() => setSearch("")}
              onClearCategory={() => selectCategory("")}
            />
          )}
        </section>
      </div>

      <ServiceFilterSheet
        open={isFilterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelect={selectCategory}
        serviceCounts={serviceCounts}
        totalCount={services.length}
      />
    </CustomerServiceLayout>
  );
}
