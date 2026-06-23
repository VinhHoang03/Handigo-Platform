import { useCallback, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
  const [isSelectingServices, setIsSelectingServices] = useState(false);
  const [draftServiceIds, setDraftServiceIds] = useState<string[]>([]);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const pendingScrollTopRef = useRef<number | null>(null);

  const selectedServices = useMemo(
    () =>
      categories
        .flatMap((category) => category.services || [])
        .filter((service) => selectedServiceIds.includes(service._id)),
    [categories, selectedServiceIds],
  );

  const openServiceSelector = useCallback(() => {
    setDraftServiceIds(selectedServiceIds);
    setIsSelectingServices(true);
  }, [selectedServiceIds]);

  const closeAll = useCallback(() => {
    setIsSelectingServices(false);
    onClose();
  }, [onClose]);

  const toggleDraftService = useCallback((id: string) => {
    pendingScrollTopRef.current = modalContentRef.current?.scrollTop ?? null;
    setDraftServiceIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }, []);

  useLayoutEffect(() => {
    if (!isSelectingServices || pendingScrollTopRef.current === null) return;

    const modalContent = modalContentRef.current;
    if (modalContent) {
      modalContent.scrollTop = pendingScrollTopRef.current;
    }
    pendingScrollTopRef.current = null;
  }, [draftServiceIds, isSelectingServices]);

  return (
    <Modal
      open={open}
      title={isSelectingServices ? "Chọn dịch vụ cung cấp" : "Chỉnh sửa thông tin nghề nghiệp"}
      onClose={closeAll}
      size={isSelectingServices ? "xl" : "lg"}
      contentRef={modalContentRef}
    >
      {isSelectingServices ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-sm font-semibold text-on-surface">
              Đang chọn {draftServiceIds.length} dịch vụ cung cấp
            </p>
            <p className="mt-1 text-sm text-on-surface-variant">
              Chọn các dịch vụ cụ thể mà bạn có thể nhận từ khách hàng.
            </p>
          </div>

          <CategorySelectionStep
            categories={categories}
            selectedIds={draftServiceIds}
            experienceYears={experienceYears}
            showExperience={false}
            onExperienceChange={() => undefined}
            onToggle={toggleDraftService}
          />

          <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-3 border-t border-outline-variant/30 bg-surface px-4 pt-4 sm:-mx-8 sm:flex-row sm:justify-end sm:px-8">
            <button
              type="button"
              className="rounded-lg bg-surface-container px-4 py-3 font-bold"
              onClick={() => setIsSelectingServices(false)}
            >
              Quay lại
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={draftServiceIds.length === 0}
              onClick={() => {
                onSelectedServiceIdsChange(draftServiceIds);
                setIsSelectingServices(false);
              }}
            >
              Xác nhận dịch vụ
            </button>
          </div>
        </div>
      ) : (
        <form className="space-y-6" onSubmit={onSubmit}>
          {error && (
            <p className="rounded-xl bg-error/10 p-3 text-sm font-medium text-error">
              {error}
            </p>
          )}

          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase text-on-surface-variant">
              Giới thiệu chuyên môn
            </span>
            <textarea
              value={bio}
              rows={7}
              maxLength={2000}
              onChange={(event) => onBioChange(event.target.value)}
              className="w-full resize-y rounded-xl border border-outline-variant/40 bg-white px-4 py-3 text-sm leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="Mô tả kinh nghiệm, thế mạnh và cách bạn phục vụ khách hàng..."
            />
            <span className="mt-1 block text-right text-xs text-on-surface-variant">
              {bio.length}/2000
            </span>
          </label>

          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-on-surface">Dịch vụ đã đăng ký</p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Đã chọn {selectedServiceIds.length} dịch vụ.
                </p>

                {selectedServices.length > 0 && (
                  <div className="mt-3 flex max-h-28 flex-wrap gap-2 overflow-y-auto pr-1">
                    {selectedServices.map((service) => (
                      <span
                        key={service._id}
                        className="max-w-full truncate rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface"
                      >
                        {service.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="btn-primary w-full sm:w-auto"
                disabled={loadingServices}
                onClick={openServiceSelector}
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                {loadingServices ? "Đang tải..." : "Chỉnh sửa dịch vụ"}
              </button>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="rounded-lg bg-surface-container px-4 py-3 font-bold"
              disabled={saving}
              onClick={closeAll}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving || selectedServiceIds.length === 0}
            >
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      )}
    </Modal>
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
        {error && (
          <p className="rounded-xl bg-error/10 p-3 text-sm font-medium text-error">
            {error}
          </p>
        )}
        <WorkingAreasStep
          areas={areas}
          onAdd={(value) => !areas.includes(value) && onChange([...areas, value])}
          onRemove={(value) => onChange(areas.filter((item) => item !== value))}
        />
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="rounded-lg bg-surface-container px-4 py-2 font-bold"
            disabled={saving}
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={saving || areas.length === 0}
            onClick={onSave}
          >
            {saving ? "Đang lưu..." : "Lưu khu vực"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
