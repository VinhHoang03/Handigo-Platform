import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import type { Category } from "@/features/admin/types/categoryService.types";
import type { ServiceSuggestion, SuggestionStatus } from "../types/serviceSuggestion.types";
import { getSuggestionName, getSuggestionProviderName } from "./service-suggestion.utils";

interface ServiceSuggestionReviewModalProps {
  suggestion: ServiceSuggestion | null;
  categories: Category[];
  adminNote: string;
  onAdminNoteChange: (value: string) => void;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (status?: SuggestionStatus) => void;
  onCreateService: () => void;
}

export function ServiceSuggestionReviewModal({
  suggestion, categories, adminNote, onAdminNoteChange, isSaving,
  onClose, onSubmit, onCreateService,
}: ServiceSuggestionReviewModalProps) {
  const [isReplying, setIsReplying] = useState(false);
  const categoryName = typeof suggestion?.categoryId === "object" && suggestion.categoryId
    ? suggestion.categoryId.name
    : categories.find((category) => category._id === suggestion?.categoryId)?.name;

  return (
    <Modal open={Boolean(suggestion)} title="Chi tiết đề xuất" size="lg"
      onClose={() => { if (!isSaving) onClose(); }} closeOnEsc={!isSaving} closeOnOverlayClick={!isSaving}>
      {suggestion && (
        <div className="space-y-5">
          <dl className="space-y-4">
            <div className="rounded-lg border border-black p-4">
              <dt className="text-sm font-bold text-on-surface-variant">Tên người dùng</dt>
              <dd className="mt-1 text-on-surface">{getSuggestionProviderName(suggestion)}</dd>
            </div>
            <div className="rounded-lg border border-black p-4">
              <dt className="text-sm font-bold text-on-surface-variant">{suggestion.suggestionType === "service" ? "Tên dịch vụ" : "Tên danh mục"}</dt>
              <dd className="mt-1 break-words text-on-surface">{getSuggestionName(suggestion)}</dd>
            </div>
            {suggestion.suggestionType === "service" && <div className="rounded-lg border border-black p-4">
              <dt className="text-sm font-bold text-on-surface-variant">Danh mục đề xuất</dt>
              <dd className="mt-1 text-on-surface">{categoryName || "Chưa chọn danh mục"}</dd>
            </div>}
            <div className="rounded-lg border border-black p-4">
              <dt className="text-sm font-bold text-on-surface-variant">Mô tả</dt>
              <dd className="mt-1 whitespace-pre-line break-words text-sm leading-6 text-on-surface">{suggestion.description || "Chưa có mô tả."}</dd>
            </div>
          </dl>

          {suggestion.adminNote && <div className="rounded-lg border border-black bg-surface-container-low p-4">
            <p className="text-sm font-bold text-on-surface-variant">Phản hồi gần nhất</p>
            <p className="mt-1 whitespace-pre-line break-words text-sm">{suggestion.adminNote}</p>
          </div>}

          {isReplying && <form className="space-y-3" onSubmit={(event) => {
            event.preventDefault();
            if (adminNote.trim() && !isSaving) onSubmit();
          }}>
            <label className="block">
              <span className="mb-2 block text-sm font-bold">Nội dung phản hồi</span>
              <textarea autoFocus required maxLength={2000} rows={4} value={adminNote} disabled={isSaving}
                onChange={(event) => onAdminNoteChange(event.target.value)}
                className="w-full rounded-lg border border-black bg-surface-container-lowest px-3 py-2"
                placeholder="Nhập phản hồi gửi đến người đề xuất." />
            </label>
            <div className="flex justify-end gap-3">
              <button type="button" disabled={isSaving} className="rounded-lg bg-surface-container px-4 py-2.5 font-bold"
                onClick={() => { setIsReplying(false); onAdminNoteChange(""); }}>Hủy</button>
              <button type="submit" disabled={isSaving || !adminNote.trim()}
                className="rounded-lg bg-primary px-4 py-2.5 font-bold text-on-primary disabled:opacity-50">
                {isSaving ? "Đang gửi..." : "Gửi phản hồi"}
              </button>
            </div>
          </form>}

          {!isReplying && <div className="flex flex-col justify-end gap-3 sm:flex-row">
            <button type="button" disabled={isSaving} className="rounded-lg bg-surface-container px-4 py-2.5 font-bold"
              onClick={() => { onAdminNoteChange(""); setIsReplying(true); }}>Phản hồi</button>
            {suggestion.status === "pending" && <>
              <button type="button" disabled={isSaving} className="rounded-lg border border-error/30 px-4 py-2.5 font-bold text-error"
                onClick={() => onSubmit("rejected")}>Từ chối</button>
              <button type="button" disabled={isSaving} className="rounded-lg bg-primary px-4 py-2.5 font-bold text-on-primary"
                onClick={() => suggestion.suggestionType === "service" && !suggestion.createdServiceId ? onCreateService() : onSubmit("approved")}>
                {suggestion.suggestionType === "service" && !suggestion.createdServiceId ? "Tạo" : "Duyệt đề xuất"}
              </button>
            </>}
          </div>}
        </div>
      )}
    </Modal>
  );
}
