import type { FormEvent } from "react";
import { Modal } from "@/components/common/Modal";
import { WorkingAreasStep } from "@/features/provider-application/components/WorkingAreasStep";

interface ProfessionalDialogProps {
  open: boolean;
  bio: string;
  error?: string;
  saving?: boolean;
  onBioChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function ProfessionalProfileDialog({
  open,
  bio,
  error,
  saving,
  onBioChange,
  onClose,
  onSubmit,
}: ProfessionalDialogProps) {
  return (
    <Modal
      open={open}
      title="Chỉnh sửa giới thiệu chuyên môn"
      onClose={onClose}
      size="lg"
    >
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

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-on-surface-variant">
            Dịch vụ cung cấp chỉ được thay đổi thông qua đơn đăng ký và phê duyệt của admin.
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="rounded-lg bg-surface-container px-4 py-3 font-bold"
              disabled={saving}
              onClick={onClose}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving}
            >
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
      </form>
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
