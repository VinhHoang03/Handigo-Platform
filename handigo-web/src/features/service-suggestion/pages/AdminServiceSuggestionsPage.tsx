import { useToastFeedback } from "@/components/common/Toast";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { DataTable } from "@/components/common/dashboard/DataTable";
import type { DataTableColumn } from "@/components/common/dashboard/DataTable";
import { TableSkeleton } from "@/components/common/dashboard/TableSkeleton";
import { categoryServiceApi } from "@/features/admin/api/categoryService.api";
import type { Category } from "@/features/admin/types/categoryService.types";
import { ServiceFormModal } from '@/features/admin/components/services/ServiceFormModal';
import { emptyServiceForm, toServicePayload, type ServiceForm } from '@/features/admin/components/services/service.helpers';
import { serviceSuggestionApi } from "../api/serviceSuggestion.api";
import { ServiceSuggestionReviewModal } from "../components/ServiceSuggestionReviewModal";
import { SuggestionListHeader } from "../components/SuggestionListHeader";
import { serviceSuggestionTableColumns } from "../components/service-suggestion-table-columns";
import { getSuggestionErrorMessage, getSuggestionName } from "../components/service-suggestion.utils";
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [serviceFormOpen, setServiceFormOpen] = useState(false);
  const [serviceForm, setServiceForm] = useState<ServiceForm>({ ...emptyServiceForm, isActive: false });
  const savingRef = useRef(false);
  const [, setNotice] = useToastFeedback<string>("", "success");
  const [, setError] = useToastFeedback<string>("", "error");

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
    setServiceFormOpen(false);
    setSelectedSuggestion(suggestion);
    setAdminNote("");
    const linkedCategory =
      typeof suggestion.categoryId === "object" && suggestion.categoryId
        ? suggestion.categoryId._id
        : typeof suggestion.categoryId === "string"
          ? suggestion.categoryId
          : "";
    setCategoryId(linkedCategory);
  };

  const closeReviewModal = () => {
    setServiceFormOpen(false);
    setSelectedSuggestion(null);
    setAdminNote("");
    setCategoryId("");
  };

  const updateSuggestion = async (nextStatus?: SuggestionStatus) => {
    if (!selectedSuggestion || savingRef.current || (nextStatus === undefined && !adminNote.trim())) return;

    const payload: UpdateServiceSuggestionPayload = {
      status: nextStatus,
      ...(nextStatus === undefined ? { adminNote: adminNote.trim() } : {}),
    };

    if (nextStatus !== undefined && selectedSuggestion.suggestionType === "service") {
      payload.categoryId = categoryId || null;
    }

    savingRef.current = true;
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
            : "Đã gửi phản hồi đến người đề xuất.",
      );
      closeReviewModal();
      await loadData();
    } catch (saveError) {
      setError(getSuggestionErrorMessage(saveError));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const openServiceForm = () => {
    if (!selectedSuggestion || selectedSuggestion.status !== 'pending' || selectedSuggestion.createdServiceId) return;
    setServiceForm({ ...emptyServiceForm, name: getSuggestionName(selectedSuggestion), description: selectedSuggestion.description || '', categoryId, isActive: false });
    setServiceFormOpen(true);
  };

  const createServiceAndApprove = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedSuggestion || savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    try {
      await serviceSuggestionApi.update(selectedSuggestion._id, {
        status: 'approved',
        serviceDraft: toServicePayload({ ...serviceForm, isActive: false }),
      });
      setNotice('Đã tạo dịch vụ ở trạng thái tạm ngừng và duyệt đề xuất.');
      closeReviewModal();
      await loadData();
    } catch (saveError) {
      setError(getSuggestionErrorMessage(saveError));
      if ((saveError as { response?: { status?: number } }).response?.status === 409) {
        try {
          const latest = await serviceSuggestionApi.detail(selectedSuggestion._id);
          if (latest.status !== 'pending' || latest.createdServiceId) {
            openReviewModal(latest);
            await loadData();
          }
        } catch { /* Giữ nguyên form nếu chưa thể tải lại đề xuất. */ }
      }
    } finally {
      savingRef.current = false;
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
          loading={isLoading}
        />


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
            minWidthClassName="min-w-[700px]"
          />
        </AsyncState>
      </div>

      <ServiceSuggestionReviewModal
        key={selectedSuggestion?._id ?? "closed"}
        suggestion={serviceFormOpen ? null : selectedSuggestion}
        categories={categories}
        adminNote={adminNote}
        onAdminNoteChange={setAdminNote}
        isSaving={isSaving}
        onClose={closeReviewModal}
        onSubmit={(nextStatus) => void updateSuggestion(nextStatus)}
        onCreateService={openServiceForm}
      />
      <ServiceFormModal open={serviceFormOpen} mode="create" categories={categories} form={serviceForm}
        busy={isSaving} blockClose={isSaving} allowActivation={false} submitLabel="Tạo dịch vụ và duyệt"
        onChange={setServiceForm} onClose={() => setServiceFormOpen(false)} onSubmit={event => void createServiceAndApprove(event)} />
    </DashboardShell>
  );
}
