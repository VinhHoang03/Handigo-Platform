import type { FormEvent } from "react";
import type { Category } from "@/features/admin/types/categoryService.types";

export const NEW_CATEGORY_VALUE = "new-category";

type ProviderServiceSuggestionFormProps = {
  categories: Category[];
  serviceName: string;
  categoryName: string;
  categoryId: string;
  description: string;
  isLoadingCategories: boolean;
  isSubmitting: boolean;
  message: string;
  error: string;
  onServiceNameChange: (value: string) => void;
  onCategoryIdChange: (value: string) => void;
  onCategoryNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
};

export function ProviderServiceSuggestionForm({
  categories,
  serviceName,
  categoryName,
  categoryId,
  description,
  isLoadingCategories,
  isSubmitting,
  message,
  error,
  onServiceNameChange,
  onCategoryIdChange,
  onCategoryNameChange,
  onDescriptionChange,
  onSubmit,
  onReset,
}: ProviderServiceSuggestionFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-5 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm lg:grid-cols-3"
    >
      {(message || error) && (
        <div
          className={`lg:col-span-3 rounded-lg px-4 py-3 text-sm font-medium ${
            error
              ? "bg-error/10 text-error"
              : "bg-success-container text-on-success-container"
          }`}
        >
          {error || message}
        </div>
      )}

      <label className="block lg:col-span-2">
        <span className="mb-2 block text-sm font-bold text-on-surface">
          Tên dịch vụ đề xuất
        </span>
        <input
          value={serviceName}
          onChange={(event) => onServiceNameChange(event.target.value)}
          className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          placeholder="Ví dụ: Vệ sinh máy lạnh treo tường"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-on-surface">
          Danh mục liên quan
        </span>
        <select
          value={categoryId}
          disabled={isLoadingCategories}
          onChange={(event) => {
            onCategoryIdChange(event.target.value);
            onCategoryNameChange("");
          }}
          className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
        >
          <option value="">Chưa xác định</option>
          {categories.map((category) => (
            <option key={category._id} value={category._id}>
              {category.name}
            </option>
          ))}
          <option value={NEW_CATEGORY_VALUE}>Gợi ý danh mục mới</option>
        </select>
      </label>

      {categoryId === NEW_CATEGORY_VALUE && (
        <label className="block lg:col-span-3">
          <span className="mb-2 block text-sm font-bold text-on-surface">
            Tên danh mục mới
          </span>
          <input
            value={categoryName}
            onChange={(event) => onCategoryNameChange(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            placeholder="Ví dụ: Chăm sóc thú cưng tại nhà"
          />
        </label>
      )}

      <label className="block lg:col-span-3">
        <span className="mb-2 block text-sm font-bold text-on-surface">
          Mô tả đề xuất
        </span>
        <textarea
          value={description}
          rows={6}
          onChange={(event) => onDescriptionChange(event.target.value)}
          className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          placeholder="Nêu lý do nên bổ sung, nhu cầu khách hàng, phạm vi công việc hoặc gợi ý cách triển khai."
        />
      </label>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end lg:col-span-3">
        <button
          type="button"
          className="min-h-11 w-full rounded-lg bg-surface-container px-5 py-2.5 font-bold sm:w-auto"
          disabled={isSubmitting}
          onClick={onReset}
        >
          Làm mới
        </button>
        <button
          type="submit"
          className="min-h-11 w-full rounded-lg bg-primary px-5 py-2.5 font-bold text-on-primary disabled:opacity-60 sm:w-auto"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Đang gửi..." : "Gửi đề xuất"}
        </button>
      </div>
    </form>
  );
}
