import { Modal } from "@/components/common/Modal";
import type { Category } from "@/features/admin/types/categoryService.types";
import type { ServiceSuggestion, SuggestionStatus } from "../types/serviceSuggestion.types";
import { getSuggestionName, suggestionTypeLabel } from "./service-suggestion.utils";

interface ServiceSuggestionReviewModalProps {
  suggestion: ServiceSuggestion | null;
  categories: Category[];
  categoryId: string;
  onCategoryIdChange: (value: string) => void;
  createdCategoryId: string;
  onCreatedCategoryIdChange: (value: string) => void;
  adminNote: string;
  onAdminNoteChange: (value: string) => void;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (status: SuggestionStatus) => void;
}

export function ServiceSuggestionReviewModal({
  suggestion,
  categories,
  categoryId,
  onCategoryIdChange,
  createdCategoryId,
  onCreatedCategoryIdChange,
  adminNote,
  onAdminNoteChange,
  isSaving,
  onClose,
  onSubmit,
}: ServiceSuggestionReviewModalProps) {
  const createdServiceName = suggestion?.createdServiceId
    ? typeof suggestion.createdServiceId === "object"
      ? suggestion.createdServiceId.name
      : suggestion.createdServiceId
    : "";

  return (
    <Modal open={Boolean(suggestion)} title="Xử lý đề xuất" size="lg" onClose={onClose}>
      {suggestion && (
        <div className="space-y-5">
          <div className="rounded-lg bg-surface-container-low p-4">
            <p className="text-xs font-bold uppercase text-on-surface-variant">
              {suggestionTypeLabel[suggestion.suggestionType]}
            </p>
            <h2 className="mt-1 text-xl font-bold text-on-surface">{getSuggestionName(suggestion)}</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-on-surface-variant">
              {suggestion.description || "Provider chưa nhập mô tả."}
            </p>
          </div>

          {suggestion.suggestionType === "service" ? (
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-on-surface">
                Danh mục sẽ gán service
              </span>
              <select
                value={categoryId}
                onChange={(event) => onCategoryIdChange(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2"
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
                onChange={(event) => onCreatedCategoryIdChange(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2"
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
            <span className="mb-2 block text-sm font-bold text-on-surface">Ghi chú admin</span>
            <textarea
              rows={4}
              value={adminNote}
              onChange={(event) => onAdminNoteChange(event.target.value)}
              className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2"
              placeholder="Nhập lý do duyệt, từ chối hoặc hướng xử lý tiếp theo."
            />
          </label>

          <div className="flex flex-col justify-end gap-3 sm:flex-row">
            <button
              type="button"
              className="rounded-lg bg-surface-container px-4 py-2.5 font-bold"
              disabled={isSaving}
              onClick={() => onSubmit("pending")}
            >
              Lưu ghi chú
            </button>
            <button
              type="button"
              className="rounded-lg border border-error/30 px-4 py-2.5 font-bold text-error"
              disabled={isSaving}
              onClick={() => onSubmit("rejected")}
            >
              Từ chối
            </button>
            <button
              type="button"
              className="rounded-lg bg-primary px-4 py-2.5 font-bold text-on-primary"
              disabled={isSaving}
              onClick={() => onSubmit("approved")}
            >
              Duyệt đề xuất
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
