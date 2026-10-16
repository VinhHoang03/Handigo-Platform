import { CategoryIcon } from "@/components/common/CategoryIcon";
import type { DataTableColumn } from "@/components/common/dashboard/DataTable";
import type { Category } from "../../types/categoryService.types";
import { formatCategoryDate } from "./category.helpers";
import {
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Pencil,
  Pin,
  Plus,
  Trash2,
} from "lucide-react";

interface CategoryTableContext {
  serviceCounts: Record<string, number>;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  pinnedIds: string[];
  onTogglePin: (id: string) => void;
  onCreateService: (category: Category) => void;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
}

/** Cột bảng danh mục, gồm cả cột "Thao tác" (sửa/xóa). */
export function buildCategoryTableColumns({
  serviceCounts,
  onEdit,
  onDelete,
  pinnedIds,
  onTogglePin,
  onCreateService,
  expandedId,
  onToggleExpand,
}: CategoryTableContext): Array<DataTableColumn<Category>> {
  return [
    {
      key: "category",
      header: "Danh mục",
      render: (category) => (
        <div className="group relative flex items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/10 bg-primary-fixed-dim/30 text-primary"
            style={category.iconColor ? { backgroundColor: `${category.iconColor}0d`, borderColor: `${category.iconColor}30` } : undefined}
          >
            <CategoryIcon
              icon={category.icon}
              color={category.iconColor}
              name={category.name}
              className="h-7 w-7"
            />
          </div>
          <span className="group/description relative inline-flex items-center gap-1">
            <span className="font-bold text-on-surface">{category.name}</span>
            <span className="rounded-full p-0.5 text-on-surface-variant" aria-label={`Xem mô tả danh mục ${category.name}`}>
              <CircleAlert aria-hidden="true" size={16} />
            </span>
            <span className="pointer-events-none absolute bottom-full right-[-20px] z-30 mb-2 hidden w-max whitespace-pre-wrap rounded-md border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-normal text-amber-950 shadow-lg group-hover/description:block">
              {category.description || "Chưa có mô tả"}
            </span>
          </span>
        </div>
      ),
    },
    {
      key: "serviceCount",
      header: "Số dịch vụ",
      render: (category) => (
        <span className="rounded-full bg-surface-container-high px-3 py-1 text-label-md font-medium text-on-surface-variant">
          {serviceCounts[category._id] || 0} dịch vụ
        </span>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (category) =>
        category.isActive ? (
          <div className="flex items-center gap-2 text-label-md font-bold text-success">
            <span className="h-2 w-2 rounded-full bg-success" /> Hoạt động
          </div>
        ) : (
          <div className="flex items-center gap-2 text-label-md font-bold text-error">
            <span className="h-2 w-2 rounded-full bg-error" /> Tạm ngưng
          </div>
        ),
    },
    {
      key: "createdAt",
      header: "Ngày tạo",
      className: "text-on-surface-variant tabular-nums",
      render: (category) => formatCategoryDate(category.createdAt),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (category) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpand(category._id);
            }}
            className="rounded-lg p-2 text-on-surface-variant opacity-0 transition-all hover:bg-primary-container/10 hover:text-primary group-hover:opacity-100 focus-visible:opacity-100"
            aria-label={
              expandedId === category._id
                ? "Thu gọn dịch vụ"
                : "Xem dịch vụ thuộc danh mục"
            }
            aria-expanded={expandedId === category._id}
          >
            {expandedId === category._id ? (
              <ChevronUp aria-hidden="true" size={22} />
            ) : (
              <ChevronDown aria-hidden="true" size={22} />
            )}
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onCreateService(category);
            }}
            className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-primary-container/10 hover:text-primary"
            aria-label={`Thêm dịch vụ vào ${category.name}`}
          >
            <Plus aria-hidden="true" size={22} />
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onTogglePin(category._id);
            }}
            className={`rounded-lg p-2 transition-colors hover:bg-primary-container/10 ${pinnedIds.includes(category._id) ? "text-primary" : "text-on-surface-variant"}`}
            aria-label={
              pinnedIds.includes(category._id)
                ? "Bỏ ghim danh mục"
                : "Ghim danh mục"
            }
            aria-pressed={pinnedIds.includes(category._id)}
          >
            <Pin
              aria-hidden="true"
              size={22}
              fill={pinnedIds.includes(category._id) ? "currentColor" : "none"}
            />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit(category);
            }}
            className="rounded-lg p-2 transition-colors hover:bg-primary-container/10 hover:text-primary"
            aria-label="Sửa"
          >
            <Pencil aria-hidden="true" size={24} />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(category);
            }}
            className="rounded-lg p-2 transition-colors hover:bg-error-container/20 hover:text-error"
            aria-label="Xóa"
          >
            <Trash2 aria-hidden="true" size={24} />
          </button>
        </div>
      ),
    },
  ];
}
