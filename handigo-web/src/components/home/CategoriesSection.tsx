import { Link } from "react-router-dom";
import { SectionHeader } from "../common/SectionHeader";
import { CategoryBento } from "./CategoryBento";
import { CategoryCardSkeleton, HomeEmptyState } from "./HomeSkeletons";
import type { CategoryShowcaseItem } from "@/features/home/hooks/useCategoryShowcase";
import { ArrowRight } from "lucide-react";

interface CategoriesSectionProps {
  items: CategoryShowcaseItem[];
  loading: boolean;
}

/**
 * Mô tả từng danh mục trước đây là chuỗi độn `"Xem các dịch vụ phù hợp trong
 * danh mục"` lặp lại 8 lần — chữ chiếm chỗ mà không nói gì. Thay bằng số dịch vụ
 * thật trong danh mục: ngắn hơn, và là thông tin người dùng dùng được.
 */
export const CategoriesSection = ({
  items,
  loading,
}: CategoriesSectionProps) => (
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
          className="flex min-h-11 w-fit items-center gap-1.5 text-label-md font-semibold text-primary transition-colors hover:text-primary-hover"
        >
          Xem tất cả
          <ArrowRight aria-hidden="true" size={18} />
        </Link>
      }
    />

    {loading ? (
      <div className="grid grid-cols-2 gap-4 md:gap-5 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <CategoryCardSkeleton key={item} />
        ))}
      </div>
    ) : items.length ? (
      <CategoryBento items={items} />
    ) : (
      <HomeEmptyState message="Chưa có danh mục dịch vụ nào để hiển thị." />
    )}
  </section>
);
