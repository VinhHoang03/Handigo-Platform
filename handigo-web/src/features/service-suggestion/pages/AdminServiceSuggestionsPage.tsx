import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/common/DashboardShell";
import { Modal } from "@/components/common/Modal";
import { categoryServiceApi } from "@/features/admin/api/categoryService.api";
import type { Category } from "@/features/admin/types/categoryService.types";
import { serviceSuggestionApi } from "../api/serviceSuggestion.api";
import type {
  ServiceSuggestion,
  SuggestionStatus,
  SuggestionType,
  UpdateServiceSuggestionPayload,
} from "../types/serviceSuggestion.types";

const statusLabel: Record<SuggestionStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
};

const typeLabel: Record<SuggestionType, string> = {
  service: "Service",
  category: "Category",
};

const statusClass: Record<SuggestionStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

const getErrorMessage = (error: unknown) => {
  const err = error as { response?: { data?: { message?: string } } };
  return err?.response?.data?.message || "Không thể xử lý đề xuất. Vui lòng thử lại.";
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const getSuggestionName = (suggestion: ServiceSuggestion) =>
  suggestion.suggestionType === "service"
    ? suggestion.suggestedServiceName || "Dịch vụ chưa đặt tên"
    : suggestion.suggestedCategoryName || "Danh mục chưa đặt tên";

const getProviderName = (suggestion: ServiceSuggestion) => {
  if (typeof suggestion.providerId === "string") return suggestion.providerId;
  const user = suggestion.providerId.userId;
  if (typeof user === "object" && user?.fullName) return user.fullName;
  return "Provider";
};

export default function AdminServiceSuggestionsPage() {
  const [suggestions, setSuggestions] = useState<ServiceSuggestion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState<SuggestionStatus | "">("pending");
  const [suggestionType, setSuggestionType] = useState<SuggestionType | "">("");
  const [selectedSuggestion, setSelectedSuggestion] =
    useState<ServiceSuggestion | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [createdCategoryId, setCreatedCategoryId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    setError("");
    try {
      const [suggestionResult, categoryResult] =
        await Promise.all([
          serviceSuggestionApi.list({
            page: 1,
            limit: 100,
            status,
            suggestionType,
          }),
          categoryServiceApi.listCategories({ page: 1, limit: 200 }),
        ]);
      setSuggestions(suggestionResult.items);
      setCategories(categoryResult.items);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, suggestionType]);

  const openReviewModal = (suggestion: ServiceSuggestion) => {
    setSelectedSuggestion(suggestion);
    setAdminNote(suggestion.adminNote || "");
    const linkedCategory =
      typeof suggestion.categoryId === "object" && suggestion.categoryId
        ? suggestion.categoryId._id
        : typeof suggestion.categoryId === "string"
          ? suggestion.categoryId
          : "";
    setCategoryId(linkedCategory);
    setCreatedCategoryId(
      typeof suggestion.createdCategoryId === "object" && suggestion.createdCategoryId
        ? suggestion.createdCategoryId._id
        : typeof suggestion.createdCategoryId === "string"
          ? suggestion.createdCategoryId
          : "",
    );
  };

  const closeReviewModal = () => {
    setSelectedSuggestion(null);
    setAdminNote("");
    setCategoryId("");
    setCreatedCategoryId("");
  };

  const updateSuggestion = async (nextStatus: SuggestionStatus) => {
    if (!selectedSuggestion) return;

    const payload: UpdateServiceSuggestionPayload = {
      status: nextStatus,
      adminNote: adminNote.trim() || null,
    };

    if (selectedSuggestion.suggestionType === "service") {
      payload.categoryId = categoryId || null;
    } else {
      payload.createdCategoryId = createdCategoryId || null;
    }

    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      await serviceSuggestionApi.update(selectedSuggestion._id, payload);
      setNotice(
        nextStatus === "approved"
          ? "Đã duyệt đề xuất."
          : nextStatus === "rejected"
            ? "Đã từ chối đề xuất."
            : "Đã cập nhật đề xuất.",
      );
      closeReviewModal();
      await loadData();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  const createdServiceName = useMemo(() => {
    if (!selectedSuggestion?.createdServiceId) return "";
    return typeof selectedSuggestion.createdServiceId === "object"
      ? selectedSuggestion.createdServiceId.name
      : selectedSuggestion.createdServiceId;
  }, [selectedSuggestion]);

  return (
    <DashboardShell role="ADMIN">
      <div className="space-y-5">
        <header className="flex flex-col gap-4 rounded-xl border border-outline-variant/30 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase text-primary">Đề xuất từ provider</p>
            <h1 className="mt-2 text-2xl font-bold text-on-surface">
              Quản lý đề xuất service và category
            </h1>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-surface-container px-4 py-2.5 font-bold text-on-surface-variant hover:text-primary"
            onClick={() => void loadData()}
          >
            <span className="material-symbols-outlined">refresh</span>
            Tải lại
          </button>
        </header>

        <div className="grid grid-cols-1 gap-3 rounded-xl border border-outline-variant/30 bg-white p-4 shadow-sm md:grid-cols-3">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as SuggestionStatus | "")}
            className="min-h-11 rounded-lg border border-outline-variant/40 bg-white px-3 py-2"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="pending">Chờ duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="rejected">Từ chối</option>
          </select>
          <select
            value={suggestionType}
            onChange={(event) => setSuggestionType(event.target.value as SuggestionType | "")}
            className="min-h-11 rounded-lg border border-outline-variant/40 bg-white px-3 py-2"
          >
            <option value="">Tất cả loại đề xuất</option>
            <option value="service">Service</option>
            <option value="category">Category</option>
          </select>
          <div className="flex items-center rounded-lg bg-surface-container-low px-4 text-sm font-medium text-on-surface-variant">
            {suggestions.length} đề xuất
          </div>
        </div>

        {(notice || error) && (
          <div
            className={`rounded-lg px-4 py-3 text-sm font-medium ${
              error ? "bg-error/10 text-error" : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {error || notice}
          </div>
        )}

        <section className="overflow-hidden rounded-xl border border-outline-variant/30 bg-white shadow-sm">
          {isLoading ? (
            <div className="p-8 text-center text-on-surface-variant">
              Đang tải đề xuất...
            </div>
          ) : suggestions.length === 0 ? (
            <div className="p-8 text-center text-on-surface-variant">
              Chưa có đề xuất phù hợp.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-surface-container-low text-xs uppercase text-on-surface-variant">
                  <tr>
                    <th className="px-4 py-3">Đề xuất</th>
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3">Loại</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Ngày gửi</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {suggestions.map((suggestion) => (
                    <tr key={suggestion._id} className="hover:bg-surface-container-low/60">
                      <td className="px-4 py-4">
                        <p className="font-bold text-on-surface">
                          {getSuggestionName(suggestion)}
                        </p>
                        <p className="mt-1 line-clamp-2 max-w-md text-on-surface-variant">
                          {suggestion.description || "Không có mô tả."}
                        </p>
                      </td>
                      <td className="px-4 py-4 font-medium">{getProviderName(suggestion)}</td>
                      <td className="px-4 py-4">{typeLabel[suggestion.suggestionType]}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusClass[suggestion.status]}`}
                        >
                          {statusLabel[suggestion.status]}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-on-surface-variant">
                        {formatDate(suggestion.createdAt)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          className="rounded-lg bg-primary px-4 py-2 font-bold text-on-primary"
                          onClick={() => openReviewModal(suggestion)}
                        >
                          Xử lý
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <Modal
        open={Boolean(selectedSuggestion)}
        title="Xử lý đề xuất"
        size="lg"
        onClose={closeReviewModal}
      >
        {selectedSuggestion && (
          <div className="space-y-5">
            <div className="rounded-lg bg-surface-container-low p-4">
              <p className="text-xs font-bold uppercase text-on-surface-variant">
                {typeLabel[selectedSuggestion.suggestionType]}
              </p>
              <h2 className="mt-1 text-xl font-bold text-on-surface">
                {getSuggestionName(selectedSuggestion)}
              </h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-on-surface-variant">
                {selectedSuggestion.description || "Provider chưa nhập mô tả."}
              </p>
            </div>

            {selectedSuggestion.suggestionType === "service" ? (
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-on-surface">
                  Danh mục sẽ gán service
                </span>
                <select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-white px-3 py-2"
                >
                  <option value="">Chọn danh mục</option>
                  {categories.map((category) => (
                    <option key={category._id} value={category._id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-on-surface-variant">
                  Khi duyệt, hệ thống tự tạo service mới từ đề xuất trong danh mục này.
                  {createdServiceName ? ` Service đã tạo: ${createdServiceName}.` : ""}
                </p>
              </label>
            ) : (
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-on-surface">
                  Gắn category đã tạo
                </span>
                <select
                  value={createdCategoryId}
                  onChange={(event) => setCreatedCategoryId(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-white px-3 py-2"
                >
                  <option value="">Chưa gắn category</option>
                  {categories.map((category) => (
                    <option key={category._id} value={category._id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-on-surface">
                Ghi chú admin
              </span>
              <textarea
                rows={4}
                value={adminNote}
                onChange={(event) => setAdminNote(event.target.value)}
                className="w-full rounded-lg border border-outline-variant/40 bg-white px-3 py-2"
                placeholder="Nhập lý do duyệt, từ chối hoặc hướng xử lý tiếp theo."
              />
            </label>

            <div className="flex flex-col justify-end gap-3 sm:flex-row">
              <button
                type="button"
                className="rounded-lg bg-surface-container px-4 py-2.5 font-bold"
                disabled={isSaving}
                onClick={() => void updateSuggestion("pending")}
              >
                Lưu ghi chú
              </button>
              <button
                type="button"
                className="rounded-lg border border-error/30 px-4 py-2.5 font-bold text-error"
                disabled={isSaving}
                onClick={() => void updateSuggestion("rejected")}
              >
                Từ chối
              </button>
              <button
                type="button"
                className="rounded-lg bg-primary px-4 py-2.5 font-bold text-on-primary"
                disabled={isSaving}
                onClick={() => void updateSuggestion("approved")}
              >
                Duyệt đề xuất
              </button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardShell>
  );
}
