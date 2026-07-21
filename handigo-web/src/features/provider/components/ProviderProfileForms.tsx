import { useRef, type FormEvent } from "react";
import type { Category } from "@/features/provider-application/types/providerApplication.types";
import type { IdentityDocumentType } from "../types/provider.types";
import type {
  CertificateForm,
  IdentityForm,
} from "../utils/providerProfilePage";
import { isImageUrl } from "../utils/providerProfilePage";
import { ToggleSwitch } from "@/components/common/ToggleSwitch";

export function ProfileTextInput({
  id,
  label,
  value,
  type = "text",
  required = false,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  type?: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase text-on-surface-variant">
        {label}
      </span>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
    </label>
  );
}

export function ProfileTextArea({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block md:col-span-2">
      <span className="mb-2 block text-xs font-bold uppercase text-on-surface-variant">
        {label}
      </span>
      <textarea
        id={id}
        value={value}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
    </label>
  );
}

function ProfileSelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: Array<{ label: string; value: T }>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase text-on-surface-variant">
        {label}
      </span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="min-h-11 w-full rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function UploadedAssetPreview({
  url,
  label,
  onRemove,
}: {
  url: string;
  label: string;
  onRemove?: () => void;
}) {
  return (
    <div className="rounded-lg border border-outline-variant/30 bg-white p-3">
      {isImageUrl(url) ? (
        <img
          src={url}
          alt={label}
          className="h-28 w-full rounded-lg object-cover"
        />
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex h-28 items-center justify-center rounded-lg bg-surface-container-low text-sm font-bold text-primary"
        >
          Xem tài liệu
        </a>
      )}
      {onRemove && (
        <button
          type="button"
          className="mt-2 text-xs font-bold text-error hover:underline"
          onClick={onRemove}
        >
          Xóa
        </button>
      )}
    </div>
  );
}

function FileUploadSlot({
  id,
  label,
  value,
  accept,
  uploading,
  onUpload,
  onRemove,
}: {
  id: string;
  label: string;
  value?: string;
  accept: string;
  uploading?: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase text-on-surface-variant">
          {label}
        </p>
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-on-primary transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <span className="material-symbols-outlined text-[18px]">upload</span>
          {uploading ? "Đang tải..." : value ? "Thay đổi" : "Tải lên"}
        </button>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
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
      {value ? (
        <UploadedAssetPreview url={value} label={label} onRemove={onRemove} />
      ) : (
        <div className="rounded-lg border border-dashed border-outline-variant/60 bg-surface-container-low p-5 text-center text-sm text-on-surface-variant">
          Chưa có tệp.
        </div>
      )}
    </div>
  );
}

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
        <div className="flex items-center justify-between gap-4 rounded-xl border border-outline-variant/30 bg-white/80 p-4 md:col-span-2">
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
            <span className="material-symbols-outlined text-[18px]">
              upload
            </span>
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
          <div className="rounded-lg border border-dashed border-outline-variant/60 bg-white/70 p-5 text-center text-sm text-on-surface-variant">
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

export function ProfessionalFormSummary({
  categories,
  selectedServiceIds,
}: {
  categories: Category[];
  selectedServiceIds: string[];
}) {
  const selectedServices = categories
    .flatMap((category) => category.services || [])
    .filter((service) => selectedServiceIds.includes(service._id));

  if (selectedServices.length === 0) {
    return null;
  }

  return (
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
  );
}
