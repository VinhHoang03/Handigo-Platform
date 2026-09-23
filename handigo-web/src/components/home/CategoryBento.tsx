import { Link } from "react-router-dom";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { CategoryIcon } from "../common/CategoryIcon";
import "./home-motion.css";
import type { CategoryShowcaseItem } from "@/features/home/hooks/useCategoryShowcase";

export const CategoryBento = ({ items }: { items: CategoryShowcaseItem[] }) => (
  <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
    {items.map((item) => (
      <Link key={item.id} to={`/customer/services?categoryId=${item.id}`} className="home-category-card group flex min-w-0 flex-col overflow-hidden rounded-2xl transition-colors hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary">
        <div aria-hidden="true" className="home-category-art">
          <span className="home-category-object">
            <CategoryIcon icon={item.icon} name={item.name} className="h-8 w-8 sm:h-11 sm:w-11" strokeWidth={1.4} />
          </span>
          <Sparkles className="home-category-sparkle" size={20} strokeWidth={1.4} />
          <span className="home-category-dot" />
        </div>
        <div className="flex flex-1 items-start justify-between gap-2 p-3 sm:p-4">
          <div className="min-w-0">
            <h3 className="break-words font-headline-md text-base font-semibold text-on-surface transition-colors group-hover:text-primary">{item.name}</h3>
            <p className="mt-1 text-label-sm text-on-surface-variant">{item.serviceCount} dịch vụ</p>
          </div>
          <ArrowUpRight aria-hidden="true" size={18} className="mt-1 shrink-0 text-primary" />
        </div>
      </Link>
    ))}
  </div>
);
