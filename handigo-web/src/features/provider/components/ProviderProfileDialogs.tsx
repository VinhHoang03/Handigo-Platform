import { useState, type FormEvent } from "react";
import { Modal } from "@/components/common/Modal";
import { CategorySelectionStep } from "@/features/provider-application/components/CategorySelectionStep";
import { WorkingAreasStep } from "@/features/provider-application/components/WorkingAreasStep";
import type { Category } from "@/features/provider-application/types/providerApplication.types";

interface ProfessionalDialogProps {
  open: boolean;
  bio: string;
  selectedServiceIds: string[];
  categories: Category[];
  experienceYears: number;
  loadingServices?: boolean;
  error?: string;
  saving?: boolean;
  onBioChange: (value: string) => void;
  onSelectedServiceIdsChange: (ids: string[]) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function ProfessionalProfileDialog({
  open,
  bio,
  selectedServiceIds,
  categories,
  experienceYears,
  loadingServices,
  error,
  saving,
  onBioChange,
  onSelectedServiceIdsChange,
  onClose,
  onSubmit,
}: ProfessionalDialogProps) {
  const [serviceSelectorOpen, setServiceSelectorOpen] = useState(false);
  const [draftServiceIds, setDraftServiceIds] = useState<string[]>([]);

  const openServiceSelector = () => {
    setDraftServiceIds(selectedServiceIds);
    setServiceSelectorOpen(true);
  };

  const closeAll = () => {
    setServiceSelectorOpen(false);
    onClose();
  };

  return (
    <>
      <Modal open={open} title="Chỉnh sửa thông tin nghề nghiệp" onClose={closeAll} size="lg">
        <form className="space-y-6" onSubmit={onSubmit}>
          {error && <p className="rounded-xl bg-error/10 p-3 text-sm font-medium text-error">{error}</p>}
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase text-on-surface-variant">Giới thiệu chuyên môn</span>
            <textarea
              value={bio}
              rows={7}
              maxLength={2000}
              onChange={(event) => onBioChange(event.target.value)}
              className="w-full resize-y rounded-xl border border-outline-variant/40 bg-white px-4 py-3 text-sm leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="Mô tả kinh nghiệm, thế mạnh và cách bạn phục vụ khách hàng..."
            />
            <span className="mt-1 block text-right text-xs text-on-surface-variant">{bio.length}/2000</span>
          </label>

          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold text-on-surface">Dịch vụ đã đăng ký</p>
                <p className="mt-1 text-sm text-on-surface-variant">Đã chọn {selectedServiceIds.length} dịch vụ.</p>
              </div>
              <button type="button" className="btn-primary" disabled={loadingServices} onClick={openServiceSelector}>
                <span className="material-symbols-outlined text-[18px]">add</span>
                {loadingServices ? "Đang tải..." : "Thêm dịch vụ"}
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" className="rounded-lg bg-surface-container px-4 py-2 font-bold" disabled={saving} onClick={closeAll}>Hủy</button>
            <button type="submit" className="btn-primary" disabled={saving || selectedServiceIds.length === 0}>{saving ? "Đang lưu..." : "Lưu thay đổi"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={serviceSelectorOpen} title="Chọn dịch vụ cung cấp" onClose={() => setServiceSelectorOpen(false)} size="lg">
        <div className="space-y-6">
          <CategorySelectionStep
            categories={categories}
            selectedIds={draftServiceIds}
            experienceYears={experienceYears}
            showExperience={false}
            onExperienceChange={() => undefined}
            onToggle={(id) => setDraftServiceIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
          />
          <div className="sticky bottom-0 flex justify-end gap-3 border-t border-outline-variant/30 bg-surface pt-4">
            <button type="button" className="rounded-lg bg-surface-container px-4 py-2 font-bold" onClick={() => setServiceSelectorOpen(false)}>Hủy</button>
            <button type="button" className="btn-primary" disabled={draftServiceIds.length === 0} onClick={() => { onSelectedServiceIdsChange(draftServiceIds); setServiceSelectorOpen(false); }}>Xác nhận dịch vụ</button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function ServiceAreaDialog({
  open,
  areas,
  saving,
  error,
  onChange,
  onClose,
  onSave,
}: {
  open: boolean;
  areas: string[];
  saving?: boolean;
  error?: string;
  onChange: (areas: string[]) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal open={open} title="Chỉnh sửa khu vực phục vụ" onClose={onClose} size="lg">
      <div className="space-y-6">
        {error && <p className="rounded-xl bg-error/10 p-3 text-sm font-medium text-error">{error}</p>}
        <WorkingAreasStep
          areas={areas}
          onAdd={(value) => !areas.includes(value) && onChange([...areas, value])}
          onRemove={(value) => onChange(areas.filter((item) => item !== value))}
        />
        <div className="flex justify-end gap-3">
          <button type="button" className="rounded-lg bg-surface-container px-4 py-2 font-bold" disabled={saving} onClick={onClose}>Hủy</button>
          <button type="button" className="btn-primary" disabled={saving || areas.length === 0} onClick={onSave}>{saving ? "Đang lưu..." : "Lưu khu vực"}</button>
        </div>
      </div>
    </Modal>
  );
}
