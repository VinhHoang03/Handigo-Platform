import { useRef, type FormEvent } from "react";
import { ToggleSwitch } from "@/components/common/ToggleSwitch";
import type { CertificateForm } from "../../utils/providerProfilePage";
import {
  ProfileTextArea,
  ProfileTextInput,
} from "./ProviderProfileFormFields";
import { UploadedAssetPreview } from "./ProviderAssetUpload";
import { Upload } from "lucide-react";

export function CertificateInlineForm({
  form,
  error,
  isSaving,
  uploading,
  showVisibility = true,
  onChange,
  onUpload,
  onCancel,
  onSubmit,
}: {
  form: CertificateForm;
  error?: string;
  isSaving?: boolean;
  uploading?: boolean;
  showVisibility?: boolean;
  onChange: (form: CertificateForm) => void;
  onUpload: (file: File) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form
      className="grid grid-cols-1 gap-4 rounded-lg border border-primary/20 bg-primary/5 p-4 md:grid-cols-2"
      onSubmit={onSubmit}
    >
      {error && (
        <div className="rounded-lg bg-error/10 p-3 text-sm text-error md:col-span-2">
          {error}
        </div>
      )}
      {showVisibility && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-outline-variant/30 bg-surface-container-lowest/80 p-4 md:col-span-2">
          <div>
            <p className="font-bold text-on-surface">Hiển thị công khai</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              Chỉ chứng chỉ đã được duyệt mới xuất hiện trên hồ sơ công khai.
            </p>
          </div>
          <ToggleSwitch
            checked={form.isPublic}
            ariaLabel="Hiển thị công khai chứng chỉ"
            onChange={(isPublic) => onChange({ ...form, isPublic })}
          />
        </div>
      )}
      <ProfileTextInput
        id="certificate-title"
        label="Tên chứng chỉ"
        value={form.title}
        required
        onChange={(value) => onChange({ ...form, title: value })}
      />
      <ProfileTextInput
        id="certificate-issuer"
        label="Đơn vị cấp"
        value={form.issuer}
        onChange={(value) => onChange({ ...form, issuer: value })}
      />
      <ProfileTextInput
        id="certificate-issued-at"
        label="Ngày cấp"
        type="date"
        value={form.issuedAt}
        onChange={(value) => onChange({ ...form, issuedAt: value })}
      />
      <ProfileTextInput
        id="certificate-expires-at"
        label="Ngày hết hạn"
        type="date"
        value={form.expiresAt}
        onChange={(value) => onChange({ ...form, expiresAt: value })}
      />
      <div className="space-y-3 md:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase text-on-surface-variant">
            Ảnh hoặc tài liệu chứng chỉ
          </p>
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-on-primary transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Upload aria-hidden="true" size={18} />
            {uploading ? "Đang tải..." : "Tải lên"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            disabled={uploading}
            tabIndex={-1}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = "";
              if (file) onUpload(file);
            }}
          />
        </div>
        {form.imageUrls.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {form.imageUrls.map((url) => (
              <UploadedAssetPreview
                key={url}
                url={url}
                label={form.title || "Chứng chỉ"}
                onRemove={() =>
                  onChange({
                    ...form,
                    imageUrls: form.imageUrls.filter((item) => item !== url),
                  })
                }
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-outline-variant/60 bg-surface-container-lowest/70 p-5 text-center text-sm text-on-surface-variant">
            Chưa có tệp chứng chỉ.
          </div>
        )}
      </div>
      <ProfileTextArea
        id="certificate-description"
        label="Mô tả"
        value={form.description}
        onChange={(value) => onChange({ ...form, description: value })}
      />
      <div className="flex justify-end gap-3 pt-2 md:col-span-2">
        <button
          type="button"
          className="rounded-lg bg-surface-container px-4 py-2 font-bold"
          disabled={isSaving}
          onClick={onCancel}
        >
          Hủy
        </button>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 font-bold text-on-primary"
          disabled={isSaving}
        >
          {isSaving ? "Đang lưu..." : "Lưu chứng chỉ"}
        </button>
      </div>
    </form>
  );
}
