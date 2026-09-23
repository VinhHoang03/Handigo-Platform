import type { FormEvent } from "react";
import { Modal } from "@/components/common/Modal";

interface PasswordFormData {
  current: string;
  next: string;
  confirm: string;
}

interface PasswordSecurityModalsProps {
  isConfirmOpen: boolean;
  isFormOpen: boolean;
  data: PasswordFormData;
  error: string;
  message: string;
  isSaving: boolean;
  onCloseConfirm: () => void;
  onConfirm: () => void;
  onCloseForm: () => void;
  onFieldChange: (field: keyof PasswordFormData, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

const FIELDS: Array<{
  field: keyof PasswordFormData;
  label: string;
  autoComplete: string;
}> = [
  { field: "current", label: "Mật khẩu hiện tại", autoComplete: "current-password" },
  { field: "next", label: "Mật khẩu mới", autoComplete: "new-password" },
  { field: "confirm", label: "Xác nhận mật khẩu mới", autoComplete: "new-password" },
];

export function PasswordSecurityModals({
  isConfirmOpen,
  isFormOpen,
  data,
  error,
  message,
  isSaving,
  onCloseConfirm,
  onConfirm,
  onCloseForm,
  onFieldChange,
  onSubmit,
}: PasswordSecurityModalsProps) {
  return (
    <>
      <Modal
        open={isConfirmOpen}
        title="Mật khẩu và bảo mật"
        onClose={onCloseConfirm}
        size="sm"
      >
        <div className="space-y-5">
          <p className="text-on-surface">Bạn có muốn cập nhật mật khẩu không?</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" className="btn-secondary flex-1" onClick={onCloseConfirm}>
              Không
            </button>
            <button type="button" className="btn-primary flex-1" onClick={onConfirm}>
              Đồng ý
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={isFormOpen} title="Cập nhật mật khẩu" onClose={onCloseForm} size="sm">
        <form onSubmit={onSubmit} className="space-y-4">
          {(error || message) && (
            <div
              className={`rounded-lg p-4 text-sm ${
                error ? "bg-error/10 text-error" : "bg-primary/10 text-primary"
              }`}
            >
              {error || message}
            </div>
          )}

          {FIELDS.map(({ field, label, autoComplete }) => (
            <label key={field} className="block">
              <span className="mb-2 block text-sm font-medium text-on-surface">
                {label}
              </span>
              <input
                type="password"
                value={data[field]}
                autoComplete={autoComplete}
                minLength={field === "current" ? undefined : 8}
                required
                onChange={(event) => onFieldChange(field, event.target.value)}
                className="min-h-12 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
          ))}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button type="button" onClick={onCloseForm} className="btn-secondary flex-1">
              Hủy bỏ
            </button>
            <button type="submit" disabled={isSaving} className="btn-primary flex-1">
              {isSaving ? "Đang xử lý..." : "Cập nhật"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
