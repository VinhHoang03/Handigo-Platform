import type { FormEvent } from "react";
import type { IdentityDocumentType } from "../../types/provider.types";
import type { IdentityForm } from "../../utils/providerProfilePage";
import {
  ProfileSelectField,
  ProfileTextInput,
} from "./ProviderProfileFormFields";
import { FileUploadSlot } from "./ProviderAssetUpload";

export function IdentityDocumentForm({
  form,
  error,
  isSaving,
  uploadingAsset,
  onChange,
  onUpload,
  onSubmit,
}: {
  form: IdentityForm;
  error?: string;
  isSaving?: boolean;
  uploadingAsset?: string | null;
  onChange: (form: IdentityForm) => void;
  onUpload: (
    field: "frontImageUrl" | "backImageUrl" | "passportImageUrl",
    file: File,
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      {error && (
        <div className="rounded-lg bg-error/10 p-3 text-sm text-error">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ProfileSelectField<IdentityDocumentType>
          id="identity-type"
          label="Loại giấy tờ"
          value={form.type}
          options={[
            { label: "CCCD", value: "cccd" },
            { label: "Hộ chiếu", value: "passport" },
          ]}
          onChange={(value) => onChange({ ...form, type: value })}
        />
        <ProfileTextInput
          id="identity-document-number"
          label="Số giấy tờ"
          value={form.documentNumber}
          required
          onChange={(value) => onChange({ ...form, documentNumber: value })}
        />
        <ProfileTextInput
          id="identity-full-name"
          label="Họ tên trên giấy tờ"
          value={form.fullName}
          required
          onChange={(value) => onChange({ ...form, fullName: value })}
        />
        <ProfileTextInput
          id="identity-issued-place"
          label="Nơi cấp"
          value={form.issuedPlace}
          onChange={(value) => onChange({ ...form, issuedPlace: value })}
        />
        <ProfileTextInput
          id="identity-issued-at"
          label="Ngày cấp"
          type="date"
          value={form.issuedAt}
          onChange={(value) => onChange({ ...form, issuedAt: value })}
        />
        <ProfileTextInput
          id="identity-expires-at"
          label="Ngày hết hạn"
          type="date"
          value={form.expiresAt}
          onChange={(value) => onChange({ ...form, expiresAt: value })}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {form.type === "cccd" ? (
          <>
            <FileUploadSlot
              id="identity-front-upload"
              label="Ảnh mặt trước"
              value={form.frontImageUrl}
              accept="image/*"
              uploading={uploadingAsset === "frontImageUrl"}
              onUpload={(file) => onUpload("frontImageUrl", file)}
              onRemove={() => onChange({ ...form, frontImageUrl: "" })}
            />
            <FileUploadSlot
              id="identity-back-upload"
              label="Ảnh mặt sau (nếu cần)"
              value={form.backImageUrl}
              accept="image/*"
              uploading={uploadingAsset === "backImageUrl"}
              onUpload={(file) => onUpload("backImageUrl", file)}
              onRemove={() => onChange({ ...form, backImageUrl: "" })}
            />
          </>
        ) : (
          <FileUploadSlot
            id="identity-passport-upload"
            label="Ảnh hộ chiếu"
            value={form.passportImageUrl}
            accept="image/*"
            uploading={uploadingAsset === "passportImageUrl"}
            onUpload={(file) => onUpload("passportImageUrl", file)}
            onRemove={() => onChange({ ...form, passportImageUrl: "" })}
          />
        )}
      </div>

      <label className="flex items-start gap-3 rounded-lg bg-surface-container-low p-4 text-sm">
        <input
          type="checkbox"
          checked={form.consentAccepted}
          required
          onChange={(event) =>
            onChange({ ...form, consentAccepted: event.target.checked })
          }
          className="mt-1 h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
        />
        <span>
          Tôi đồng ý cho Handigo xử lý dữ liệu giấy tờ cá nhân để xác thực tài
          khoản provider.
        </span>
      </label>

      <div className="flex flex-col justify-end gap-3 sm:flex-row">
        <button type="submit" className="btn-primary" disabled={isSaving}>
          {isSaving ? "Đang gửi..." : "Gửi xác thực"}
        </button>
      </div>
    </form>
  );
}
