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

      {savingDraft && step === 3 && (
        <p className="mt-5 rounded-2xl bg-surface-container-low p-3 text-sm text-on-surface-variant">
          Đang lưu ảnh và hồ sơ xác thực...
        </p>
      )}

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
        <button type="button" onClick={onBack} className="btn-secondary">
          <ArrowLeft size={18} /> {step === 1 ? "Hủy" : "Quay lại"}
        </button>
        {step < 3 ? (
          <button
            type="button"
            disabled={!canContinue}
            onClick={onNext}
            className="btn-primary"
          >
            Tiếp tục <ArrowRight size={18} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || !canSubmit}
            className="btn-primary"
          >
            <Send size={18} /> {submitting ? "Đang gửi..." : "Gửi hồ sơ"}
          </button>
        )}
      </div>
    </div>
  );
}
