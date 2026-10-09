import type { Dispatch, SetStateAction } from "react";
import { ArrowLeft, ArrowRight, Send } from "lucide-react";
import { CategorySelectionStep } from "./CategorySelectionStep";
import { ProviderDescriptionStep } from "./ProviderDescriptionStep";
import { WorkingAreasStep } from "./WorkingAreasStep";
import type {
  Category,
  OcrDocumentKind,
  ProviderApplicationAssetUpload,
  ProviderApplicationPayload,
} from "../types/providerApplication.types";

type RegisterProviderStepPanelProps = {
  step: 1 | 2 | 3;
  form: ProviderApplicationPayload;
  categories: Category[];
  onFormChange: Dispatch<SetStateAction<ProviderApplicationPayload>>;
  onToggleService: (id: string) => void;
  onExperienceChange: (years: number) => void;
  onAddArea: (area: string) => void;
  onRemoveArea: (value: string) => void;
  onUploadAsset: (
    file: File,
    purpose: "identity" | "certificate",
    documentKind: OcrDocumentKind,
  ) => Promise<ProviderApplicationAssetUpload>;
  savingDraft: boolean;
  submitError: string;
  draftError: string;
  submissionErrors: string[];
  uploading: boolean;
  isRejected: boolean;
  success: string;
  canContinue: boolean;
  canSubmit: boolean;
  submitting: boolean;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
};

export function RegisterProviderStepPanel({
  step,
  form,
  categories,
  onFormChange,
  onToggleService,
  onExperienceChange,
  onAddArea,
  onRemoveArea,
  onUploadAsset,
  savingDraft,
  submitError,
  draftError,
  submissionErrors,
  uploading,
  isRejected,
  success,
  canContinue,
  canSubmit,
  submitting,
  onBack,
  onNext,
  onSubmit,
}: RegisterProviderStepPanelProps) {
  return (
    <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-6 md:p-8">
      <fieldset disabled={submitting || Boolean(success)} className="min-w-0 disabled:pointer-events-none disabled:opacity-70">
        {step === 1 && (
          <CategorySelectionStep
            categories={categories}
            selectedIds={form.serviceIds}
            experienceYears={form.experienceYears}
            onToggle={onToggleService}
            onExperienceChange={onExperienceChange}
          />
        )}
        {step === 2 && (
          <WorkingAreasStep
            areas={form.workingAreas}
            onAdd={onAddArea}
            onRemove={onRemoveArea}
          />
        )}
        {step === 3 && (
          <ProviderDescriptionStep
            form={form}
            categories={categories}
            onChange={onFormChange}
            onUploadAsset={onUploadAsset}
          />
        )}
      </fieldset>

      {savingDraft && (
        <p className="mt-5 rounded-2xl bg-surface-container-low p-3 text-sm text-on-surface-variant">
          Đang lưu nháp hồ sơ...
        </p>
      )}

      {!success && !savingDraft && (
        <p className="mt-4 text-sm text-on-surface-variant">
          {isRejected
            ? "Bản chỉnh sửa được giữ trong phiên trình duyệt khi bạn tải lại trang. Hồ sơ chỉ được cập nhật khi bấm Gửi hồ sơ."
            : "Hồ sơ được tự động lưu nháp. Nếu chưa lưu xong, bản đang nhập được giữ trong phiên trình duyệt."}
        </p>
      )}
      {step === 3 && !success && submissionErrors.length > 0 && (
        <div className="mt-5 rounded-2xl bg-warning-container p-4 text-sm text-on-warning-container" aria-live="polite">
          <p className="font-semibold">Thông tin cần hoàn thành trước khi gửi:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {submissionErrors.map((message) => <li key={message}>{message}</li>)}
          </ul>
        </div>
      )}
      {uploading && <p className="mt-4 text-sm text-on-surface-variant" role="status">Đang tải tệp và đọc OCR. Vui lòng chờ trước khi gửi hồ sơ.</p>}

      {(submitError || draftError || success) && (
        <p
          className={`mt-5 rounded-2xl p-3 ${
            success
              ? "bg-success-container text-on-success-container"
              : "bg-error/10 text-error"
          }`}
        >
          {success || submitError || draftError}
        </p>
      )}

      <div className="mt-8 flex flex-col-reverse justify-between gap-3 sm:flex-row">
        <button type="button" onClick={onBack} disabled={submitting || Boolean(success) || uploading} className="btn-secondary">
          <ArrowLeft size={18} /> {step === 1 ? "Hủy" : "Quay lại"}
        </button>
        {step < 3 ? (
          <button
            type="button"
            disabled={!canContinue || submitting || Boolean(success)}
            onClick={onNext}
            className="btn-primary"
          >
            Tiếp tục <ArrowRight size={18} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || !canSubmit || Boolean(success)}
            className="btn-primary"
          >
            <Send size={18} /> {submitting ? "Đang gửi..." : "Gửi hồ sơ"}
          </button>
        )}
      </div>
    </div>
  );
}
