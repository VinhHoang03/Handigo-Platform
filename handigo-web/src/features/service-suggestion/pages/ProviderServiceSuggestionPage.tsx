import { useEffect, useState, type FormEvent } from "react";
import { DashboardShell } from "@/components/common/DashboardShell";
import { categoryServiceApi } from "@/features/admin/api/categoryService.api";
import type { Category } from "@/features/admin/types/categoryService.types";
import { serviceSuggestionApi } from "../api/serviceSuggestion.api";
import {
  NEW_CATEGORY_VALUE,
  ProviderServiceSuggestionForm,
} from "../components/ProviderServiceSuggestionForm";

const getErrorMessage = (error: unknown) => {
  const err = error as { response?: { data?: { message?: string } } };
  return (
    err?.response?.data?.message || "Không thể gửi đề xuất. Vui lòng thử lại."
  );
};

export default function ProviderServiceSuggestionPage() {
  const [categories, setCategories] = useState<Category[]>([]);
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

    if (!serviceName.trim()) {
      setError("Vui lòng nhập tên dịch vụ muốn đề xuất.");
      return;
    }

    if (categoryId === NEW_CATEGORY_VALUE && !categoryName.trim()) {
      setError("Vui lòng nhập tên danh mục muốn đề xuất.");
      return;
    }

    setIsSubmitting(true);
    try {
      await serviceSuggestionApi.create({
        suggestionType: "service",
        suggestedServiceName: serviceName.trim(),
        suggestedCategoryName:
          categoryId === NEW_CATEGORY_VALUE ? categoryName.trim() : null,
        categoryId:
          categoryId && categoryId !== NEW_CATEGORY_VALUE ? categoryId : null,
        description: description.trim() || null,
      });
      setMessage(
        "Đã gửi đề xuất. Admin sẽ xem xét và phản hồi trong hệ thống.",
      );
      resetForm();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardShell role="PROVIDER">
      <div className="space-y-6">
        <header className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm">
          <p className="text-sm font-bold uppercase text-primary">
            Đề xuất mở rộng dịch vụ
          </p>
          <h1 className="mt-2 text-2xl font-bold text-on-surface">
            Gửi ý tưởng dịch vụ mới{" "}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">
            Mô tả rõ nhu cầu thực tế, nhóm khách hàng phù hợp và thông tin giá
            trị mà dịch vụ hoặc danh mục mới có thể mang lại cho Handigo.
          </p>
        </header>

        <ProviderServiceSuggestionForm
          categories={categories}
          serviceName={serviceName}
          categoryName={categoryName}
          categoryId={categoryId}
          description={description}
          isLoadingCategories={isLoadingCategories}
          isSubmitting={isSubmitting}
          message={message}
          error={error}
          onServiceNameChange={setServiceName}
          onCategoryIdChange={setCategoryId}
          onCategoryNameChange={setCategoryName}
          onDescriptionChange={setDescription}
          onSubmit={(event) => void handleSubmit(event)}
          onReset={resetForm}
        />
      </div>
    </DashboardShell>
  );
}
