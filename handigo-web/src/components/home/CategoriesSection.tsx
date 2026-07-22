import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SectionHeader } from "../common/SectionHeader";
import { MaterialIcon } from "../common/MaterialIcon";
import { CategoryCard } from "./HomeCards";
import { CategoryCardSkeleton, HomeEmptyState } from "./HomeSkeletons";
import { customerServiceApi } from "@/features/customer-service/api/customerService.api";
import type { Category } from "@/types/booking";

export const CategoriesSection = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customerServiceApi
      .categories()
      .then(setCategories)
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section
      aria-labelledby="categories-heading"
      className="mx-auto mt-lg max-w-7xl px-4 md:px-8"
    >
      <SectionHeader
        id="categories-heading"
        title="Danh mục dịch vụ"
        description="Mọi vấn đề trong gia đình đều có chuyên gia phù hợp hỗ trợ bạn"
        action={
          <Link
            to="/customer/services"
            className="flex w-fit items-center gap-1.5 text-label-md font-semibold text-primary transition-colors hover:text-primary-hover"
          >
            Xem tất cả
            <MaterialIcon className="text-[18px]">arrow_forward</MaterialIcon>
          </Link>
        }
      />

      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <CategoryCardSkeleton key={item} />
          ))}
        </div>
      ) : categories.length ? (
        <div className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
          {categories.slice(0, 8).map((category, index) => (
            <CategoryCard
              key={category._id}
              icon={category.icon || "category"}
              imageUrl={category.image}
              title={category.name}
              desc={
                category.description ||
                "Xem các dịch vụ phù hợp trong danh mục"
              }
              color={["primary", "secondary", "tertiary"][index % 3]}
              to={`/customer/services?categoryId=${category._id}`}
            />
          ))}
        </div>
      ) : (
        <HomeEmptyState message="Chưa có danh mục dịch vụ nào để hiển thị." />
      )}
    </section>
  );
};
