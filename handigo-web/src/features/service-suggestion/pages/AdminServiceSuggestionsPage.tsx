import { useEffect, useMemo, useState } from "react";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { DataTable } from "@/components/common/dashboard/DataTable";
import type { DataTableColumn } from "@/components/common/dashboard/DataTable";
import { TableSkeleton } from "@/components/common/dashboard/TableSkeleton";
import { categoryServiceApi } from "@/features/admin/api/categoryService.api";
import type { Category } from "@/features/admin/types/categoryService.types";
import { serviceSuggestionApi } from "../api/serviceSuggestion.api";
import { ServiceSuggestionReviewModal } from "../components/ServiceSuggestionReviewModal";
import { SuggestionListHeader } from "../components/SuggestionListHeader";
import { serviceSuggestionTableColumns } from "../components/service-suggestion-table-columns";
import { getSuggestionErrorMessage } from "../components/service-suggestion.utils";
import type {
  ServiceSuggestion,
  SuggestionStatus,
  SuggestionType,
  UpdateServiceSuggestionPayload,
} from "../types/serviceSuggestion.types";

export default function AdminServiceSuggestionsPage() {
  const [suggestions, setSuggestions] = useState<ServiceSuggestion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState<SuggestionStatus | "">("pending");
  const [suggestionType, setSuggestionType] = useState<SuggestionType | "">("");
  const [selectedSuggestion, setSelectedSuggestion] = useState<ServiceSuggestion | null>(null);
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
      const [suggestionResult, categoryResult] = await Promise.all([
        serviceSuggestionApi.list({ page: 1, limit: 100, status, suggestionType }),
        categoryServiceApi.listCategories({ page: 1, limit: 200 }),
      ]);
      setSuggestions(suggestionResult.items);
      setCategories(categoryResult.items);
    } catch (loadError) {
      setError(getSuggestionErrorMessage(loadError));
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
      setError(getSuggestionErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  const columns = useMemo<Array<DataTableColumn<ServiceSuggestion>>>(
    () => [
      ...serviceSuggestionTableColumns,
      {
        key: "actions",
        header: "Thao tác",
        className: "text-right",
        render: (suggestion) => (
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 font-bold text-on-primary"
            onClick={() => openReviewModal(suggestion)}
          >
            Xử lý
          </button>
        ),
      },
    ],
    [],
  );

  return (
    <DashboardShell role="ADMIN">
      <div className="space-y-5">
        <SuggestionListHeader
          status={status}
          onStatusChange={setStatus}
          suggestionType={suggestionType}
          onSuggestionTypeChange={setSuggestionType}
          count={suggestions.length}
          onRefresh={() => void loadData()}
        />

        {(notice || error) && (
          <div
            className={`rounded-lg px-4 py-3 text-sm font-medium ${
              error ? "bg-error/10 text-error" : "bg-success-container text-on-success-container"
            }`}
          >
            {error || notice}
          </div>
        )}

        <AsyncState
          loading={isLoading}
          empty={!suggestions.length}
          emptyMessage="Chưa có đề xuất phù hợp."
          skeleton={<TableSkeleton columns={columns.length} rowCount={6} />}
        >
          <DataTable
            columns={columns}
            rows={suggestions}
            rowKey={(suggestion) => suggestion._id}
            minWidthClassName="min-w-[900px]"
          />
        </AsyncState>
      </div>

      <ServiceSuggestionReviewModal
        suggestion={selectedSuggestion}
        categories={categories}
        categoryId={categoryId}
        onCategoryIdChange={setCategoryId}
        createdCategoryId={createdCategoryId}
        onCreatedCategoryIdChange={setCreatedCategoryId}
        adminNote={adminNote}
        onAdminNoteChange={setAdminNote}
        isSaving={isSaving}
        onClose={closeReviewModal}
        onSubmit={(nextStatus) => void updateSuggestion(nextStatus)}
      />
    </DashboardShell>
  );
}
