import type { FormEvent } from "react";
import { Modal } from "@/components/common/Modal";
import {
  IdentityDocumentForm,
  ProfileTextInput,
} from "./ProviderProfileForms";
import type {
  IdentityForm,
  PasswordForm,
} from "../utils/providerProfilePage";

export function ProviderIdentityDialog({
  open,
  form,
  error,
  isSaving,
  uploadingAsset,
  onChange,
  onUpload,
  onClose,
  onSubmit,
}: {
  open: boolean;
  form: IdentityForm;
  error?: string;
  isSaving?: boolean;
  uploadingAsset?: string | null;
  onChange: (form: IdentityForm) => void;
  onUpload: (
    field: "frontImageUrl" | "backImageUrl" | "passportImageUrl",
    file: File,
  ) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal
      open={open}
      title="Xác thực CCCD/Hộ chiếu"
      onClose={onClose}
      size="lg"
    >
      <IdentityDocumentForm
        form={form}
        error={error}
        isSaving={isSaving}
        uploadingAsset={uploadingAsset}
        onChange={onChange}
        onUpload={onUpload}
        onSubmit={onSubmit}
      />
    </Modal>
  );
}

export function ProviderPasswordConfirmDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      title="Mật khẩu và bảo mật"
      onClose={onClose}
      size="sm"
    >
      <div className="space-y-5">
        <p className="text-on-surface">Bạn có muốn cập nhật mật khẩu không?</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>
            Không
          </button>
          <button type="button" className="btn-primary flex-1" onClick={onConfirm}>
            Đồng ý
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function ProviderPasswordUpdateDialog({
  open,
  data,
  error,
  message,
  isSaving,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  data: PasswordForm;
  error?: string;
  message?: string;
  isSaving?: boolean;
  onChange: (field: keyof PasswordForm, value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal open={open} title="Cập nhật mật khẩu" onClose={onClose} size="sm">
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

        <ProfileTextInput
          id="provider-current-password"
          label="Mật khẩu hiện tại"
          type="password"
          value={data.current}
          required
          onChange={(value) => onChange("current", value)}
        />
        <ProfileTextInput
          id="provider-new-password"
          label="Mật khẩu mới"
          type="password"
          value={data.next}
          required
          onChange={(value) => onChange("next", value)}
        />
        <ProfileTextInput
          id="provider-confirm-password"
          label="Xác nhận mật khẩu mới"
          type="password"
          value={data.confirm}
          required
          onChange={(value) => onChange("confirm", value)}
        />

        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Hủy bỏ
          </button>
          <button type="submit" disabled={isSaving} className="btn-primary flex-1">
            {isSaving ? "Đang xử lý..." : "Cập nhật"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
