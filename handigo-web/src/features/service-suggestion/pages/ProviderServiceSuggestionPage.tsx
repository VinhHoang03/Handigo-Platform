import { useEffect, useState, type FormEvent } from "react";
import { DashboardShell } from "@/components/common/DashboardShell";
import { categoryServiceApi } from "@/features/admin/api/categoryService.api";
import type { Category } from "@/features/admin/types/categoryService.types";
import { useProviderAvailability } from "@/features/provider/hooks/useProviderAvailability";
import { serviceSuggestionApi } from "../api/serviceSuggestion.api";
import type { SuggestionType } from "../types/serviceSuggestion.types";

const getErrorMessage = (error: unknown) => {
  const err = error as { response?: { data?: { message?: string } } };
  return err?.response?.data?.message || "Không thể gửi đề xuất. Vui lòng thử lại.";
};

export default function ProviderServiceSuggestionPage() {
  const { isOnline, toggleAvailability } = useProviderAvailability();
  const [categories, setCategories] = useState<Category[]>([]);
  const [suggestionType, setSuggestionType] = useState<SuggestionType>("service");
  const [serviceName, setServiceName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const result = await categoryServiceApi.listCategories({
          page: 1,
          limit: 200,
          isActive: "true",
        });
        setCategories(result.items);
      } catch {
        setCategories([]);
      } finally {
        setIsLoadingCategories(false);
      }
    };

    void loadCategories();
  }, []);

  const resetForm = () => {
    setServiceName("");
    setCategoryName("");
    setCategoryId("");
    setDescription("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (suggestionType === "service" && !serviceName.trim()) {
      setError("Vui lòng nhập tên dịch vụ muốn đề xuất.");
      return;
    }

    if (suggestionType === "category" && !categoryName.trim()) {
      setError("Vui lòng nhập tên danh mục muốn đề xuất.");
      return;
    }

    setIsSubmitting(true);
    try {
      await serviceSuggestionApi.create({
        suggestionType,
        suggestedServiceName:
          suggestionType === "service" ? serviceName.trim() : null,
        suggestedCategoryName:
          suggestionType === "category" ? categoryName.trim() : null,
        categoryId: suggestionType === "service" && categoryId ? categoryId : null,
        description: description.trim() || null,
      });
      setMessage("Đã gửi đề xuất. Admin sẽ xem xét và phản hồi trong hệ thống.");
      resetForm();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardShell
      role="PROVIDER"
      showStatusToggle
      isOnline={isOnline}
      onStatusToggle={toggleAvailability}
    >
      <div className="space-y-6">
        <header className="rounded-xl border border-outline-variant/30 bg-white p-6 shadow-sm">
          <p className="text-sm font-bold uppercase text-primary">Đề xuất mở rộng dịch vụ</p>
          <h1 className="mt-2 text-2xl font-bold text-on-surface">
            Gửi ý tưởng service hoặc category mới
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">
            Mô tả rõ nhu cầu thực tế, nhóm khách hàng phù hợp và thông tin giá trị mà
            dịch vụ hoặc danh mục mới có thể mang lại cho Handigo.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-5 rounded-xl border border-outline-variant/30 bg-white p-6 shadow-sm lg:grid-cols-3"
        >
          {(message || error) && (
            <div
              className={`lg:col-span-3 rounded-lg px-4 py-3 text-sm font-medium ${
                error ? "bg-error/10 text-error" : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {error || message}
            </div>
          )}

          <div className="lg:col-span-3">
            <span className="mb-2 block text-sm font-bold text-on-surface">
              Loại đề xuất
            </span>
            <div className="flex gap-3 sm:max-w-md">
              {[
                { value: "service", label: "Service mới", icon: "home_repair_service" },
                { value: "category", label: "Category mới", icon: "category" },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setSuggestionType(item.value as SuggestionType)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-bold transition ${
                    suggestionType === item.value
                      ? "border-primary bg-primary text-on-primary"
                      : "border-outline-variant/50 bg-surface-container-low text-on-surface-variant hover:text-primary"
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {suggestionType === "service" ? (
            <>
              <label className="block lg:col-span-2">
                <span className="mb-2 block text-sm font-bold text-on-surface">
                  Tên service đề xuất
                </span>
                <input
                  value={serviceName}
                  onChange={(event) => setServiceName(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-white px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
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
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-white px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                >
                  <option value="">Chưa xác định</option>
                  {categories.map((category) => (
                    <option key={category._id} value={category._id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <label className="block lg:col-span-3">
              <span className="mb-2 block text-sm font-bold text-on-surface">
                Tên category đề xuất
              </span>
              <input
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-white px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
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
              onChange={(event) => setDescription(event.target.value)}
              className="w-full rounded-lg border border-outline-variant/40 bg-white px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="Nêu lý do nên bổ sung, nhu cầu khách hàng, phạm vi công việc hoặc gợi ý cách triển khai."
            />
          </label>

          <div className="flex justify-end gap-3 lg:col-span-3">
            <button
              type="button"
              className="rounded-lg bg-surface-container px-5 py-2.5 font-bold"
              disabled={isSubmitting}
              onClick={resetForm}
            >
              Làm mới
            </button>
            <button
              type="submit"
              className="rounded-lg bg-primary px-5 py-2.5 font-bold text-on-primary disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Đang gửi..." : "Gửi đề xuất"}
            </button>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}
