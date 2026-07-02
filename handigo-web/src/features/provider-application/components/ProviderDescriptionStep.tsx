import { useState, type Dispatch, type SetStateAction } from "react";
import { FileText, Plus, Trash2, UploadCloud } from "lucide-react";
import {
  FloatingInput,
  FloatingTextarea,
} from "@/components/common/FloatingField";
import type {
  Category,
  IdentityDocumentType,
  OcrDocumentKind,
  ProviderApplicationAssetUpload,
  ProviderApplicationCertificate,
  ProviderApplicationOcrSuggestion,
  ProviderApplicationPayload,
} from "../types/providerApplication.types";
import { getErrorMessage } from "@/utils/apiError";
import {
  getProviderApplicationDateErrors,
  todayDate,
} from "../utils/providerApplicationValidation";

type UploadPurpose = "identity" | "certificate";

type ProviderDescriptionStepProps = {
  form: ProviderApplicationPayload;
  categories: Category[];
  onChange: Dispatch<SetStateAction<ProviderApplicationPayload>>;
  onUploadAsset: (
    file: File,
    purpose: UploadPurpose,
    documentKind: OcrDocumentKind,
  ) => Promise<ProviderApplicationAssetUpload>;
};

const emptyCertificate = (): ProviderApplicationCertificate => ({
  title: "",
  certificateNumber: "",
  issuer: "",
  issuedAt: "",
  expiresAt: "",
  imageUrls: [],
});

const isImageUrl = (url: string) =>
  /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(url) ||
  url.includes("/image/upload/");

const formatExperienceYears = (years: number) => {
  if (years === 2) return "1-2 năm";
  if (years === 5) return "3-5 năm";
  if (years >= 6) return "Trên 5 năm";
  return `${years} năm`;
};

const fillIdentityEmptyFields = (
  identity: ProviderApplicationPayload["identityDocument"],
  suggestion?: ProviderApplicationOcrSuggestion,
) => {
  if (!suggestion) return identity;
  return {
    ...identity,
    documentNumber: identity.documentNumber || suggestion.documentNumber || "",
    fullName: identity.fullName || suggestion.fullName || "",
    issuedPlace: identity.issuedPlace || suggestion.issuedPlace || "",
    issuedAt: identity.issuedAt || suggestion.issuedAt || "",
    expiresAt: identity.expiresAt || suggestion.expiresAt || "",
    dateOfBirth: identity.dateOfBirth || suggestion.dateOfBirth || "",
    gender: identity.gender || suggestion.gender,
    nationality: identity.nationality || suggestion.nationality || "",
    placeOfOrigin: identity.placeOfOrigin || suggestion.placeOfOrigin || "",
    placeOfResidence:
      identity.placeOfResidence || suggestion.placeOfResidence || "",
  };
};

const fillCertificateEmptyFields = (
  certificate: ProviderApplicationCertificate,
  suggestion?: ProviderApplicationOcrSuggestion,
) => {
  if (!suggestion) return certificate;
  return {
    ...certificate,
    title: certificate.title || suggestion.title || "",
    certificateNumber:
      certificate.certificateNumber || suggestion.certificateNumber || "",
    issuer: certificate.issuer || suggestion.issuer || "",
    issuedAt: certificate.issuedAt || suggestion.issuedAt || "",
    expiresAt: certificate.expiresAt || suggestion.expiresAt || "",
  };
};

function UploadedAsset({
  url,
  label,
  onRemove,
}: {
  url: string;
  label: string;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-3">
      {isImageUrl(url) ? (
        <img src={url} alt={label} className="h-32 w-full rounded-lg object-cover" />
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex h-32 items-center justify-center gap-2 rounded-lg bg-surface-container-low text-sm font-bold text-primary"
        >
          <FileText size={18} /> Xem tài liệu
        </a>
      )}
      <button
        type="button"
        className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-error hover:underline"
        onClick={onRemove}
      >
        <Trash2 size={14} /> Xóa
      </button>
    </div>
  );
}

function FileUploadSlot({
  id,
  label,
  value,
  uploading,
  onUpload,
  onRemove,
}: {
  id: string;
  label: string;
  value?: string;
  uploading?: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase text-on-surface-variant">{label}</p>
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-on-primary transition hover:bg-primary/90">
          <UploadCloud size={17} />
          {uploading ? "Đang tải và OCR..." : value ? "Thay đổi" : "Tải lên"}
          <input
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = "";
              if (file) onUpload(file);
            }}
          />
        </label>
      </div>
      {value ? (
        <UploadedAsset url={value} label={label} onRemove={onRemove} />
      ) : (
        <div className="rounded-lg border border-dashed border-outline-variant/60 bg-surface-container-low p-5 text-center text-sm text-on-surface-variant">
          Chưa có tệp.
        </div>
      )}
    </div>
  );
}

function IdentityTypeSelect({
  value,
  onChange,
}: {
  value: IdentityDocumentType;
  onChange: (value: IdentityDocumentType) => void;
}) {
  return (
    <label className="form-select max-w-sm">
      <span className="form-select__label">Loại giấy tờ</span>
      <select
        id="application-identity-type"
        value={value}
        onChange={(event) => onChange(event.target.value as IdentityDocumentType)}
        className="form-select__control"
      >
        <option value="cccd">CCCD</option>
        <option value="passport">Hộ chiếu</option>
      </select>
    </label>
  );
}

export function ProviderDescriptionStep({
  form,
  categories,
  onChange,
  onUploadAsset,
}: ProviderDescriptionStepProps) {
  const [uploadingKey, setUploadingKey] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [ocrMessages, setOcrMessages] = useState<Record<string, string>>({});
  const identity = form.identityDocument;
  const dateErrors = getProviderApplicationDateErrors(form);
  const today = todayDate();

  const selectedNames = categories
    .flatMap((category) => category.services || [])
    .filter((service) => form.serviceIds.includes(service._id))
    .map((service) => service.name);

  const updateIdentity = (
    value: Partial<ProviderApplicationPayload["identityDocument"]>,
  ) => {
    onChange((current) => ({
      ...current,
      identityDocument: { ...current.identityDocument, ...value },
    }));
  };

  const updateCertificate = (
    index: number,
    value: Partial<ProviderApplicationCertificate>,
  ) => {
    onChange((current) => ({
      ...current,
      certificates: current.certificates.map((certificate, currentIndex) =>
        currentIndex === index ? { ...certificate, ...value } : certificate,
      ),
    }));
  };

  const uploadIdentity = async (
    key: string,
    kind: Exclude<OcrDocumentKind, "certificate">,
    file: File,
  ) => {
    try {
      setUploadError("");
      setUploadingKey(key);
      const uploaded = await onUploadAsset(file, "identity", kind);
      onChange((current) => {
        const nextIdentity = fillIdentityEmptyFields(
          current.identityDocument,
          uploaded.ocrSuggestion,
        );
        if (kind === "cccd_front") nextIdentity.frontImageUrl = uploaded.url;
        if (kind === "cccd_back") nextIdentity.backImageUrl = uploaded.url;
        if (kind === "passport") nextIdentity.passportImageUrl = uploaded.url;
        return { ...current, identityDocument: nextIdentity };
      });
      const warning = uploaded.ocrSuggestion?.warnings.join(" ");
      setOcrMessages((current) => ({
        ...current,
        [key]: warning || "OCR hoàn tất. Bạn có thể kiểm tra và chỉnh sửa thông tin.",
      }));
    } catch (error) {
      setUploadError(getErrorMessage(error, "Không thể tải giấy tờ lên."));
    } finally {
      setUploadingKey("");
    }
  };

  const uploadCertificate = async (index: number, file: File) => {
    const key = `certificate-${index}`;
    try {
      setUploadError("");
      setUploadingKey(key);
      const uploaded = await onUploadAsset(file, "certificate", "certificate");
      onChange((current) => ({
        ...current,
        certificates: current.certificates.map((certificate, currentIndex) => {
          if (currentIndex !== index) return certificate;
          const filled = fillCertificateEmptyFields(
            certificate,
            uploaded.ocrSuggestion,
          );
          return { ...filled, imageUrls: [...filled.imageUrls, uploaded.url] };
        }),
      }));
      const warning = uploaded.ocrSuggestion?.warnings.join(" ");
      setOcrMessages((current) => ({
        ...current,
        [key]: warning || "OCR hoàn tất. Bạn có thể kiểm tra và chỉnh sửa thông tin.",
      }));
    } catch (error) {
      setUploadError(getErrorMessage(error, "Không thể tải chứng chỉ lên."));
    } finally {
      setUploadingKey("");
    }
  };

  const hasIdentityImage =
    identity.type === "cccd"
      ? Boolean(identity.frontImageUrl)
      : Boolean(identity.passportImageUrl);
  const filledCertificates = form.certificates.filter(
    (certificate) => certificate.title.trim() || certificate.imageUrls.length,
  );

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-headline-md font-bold">Giới thiệu và hồ sơ xác thực</h2>
        <p className="mt-1 text-on-surface-variant">
          Tải giấy tờ để hệ thống tự điền thông tin, sau đó kiểm tra trước khi gửi.
        </p>
      </div>

      {uploadError && (
        <p className="rounded-2xl bg-error/10 p-3 text-sm text-error">{uploadError}</p>
      )}

      <div className="space-y-5 rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-4 md:p-6">
        <div>
          <h3 className="text-title-md font-bold">Xác thực giấy tờ định danh</h3>
          <p className="mt-1 text-sm text-on-surface-variant">
            OCR chỉ hỗ trợ nhập liệu; quản trị viên vẫn kiểm tra thủ công.
          </p>
        </div>

        <IdentityTypeSelect
          value={identity.type}
          onChange={(type) => updateIdentity({ type })}
        />

        <div className="grid gap-4 md:grid-cols-2">
          {identity.type === "cccd" ? (
            <>
              <FileUploadSlot
                id="application-identity-front"
                label="Ảnh mặt trước"
                value={identity.frontImageUrl}
                uploading={uploadingKey === "identity-front"}
                onUpload={(file) => void uploadIdentity("identity-front", "cccd_front", file)}
                onRemove={() => updateIdentity({ frontImageUrl: "" })}
              />
              <FileUploadSlot
                id="application-identity-back"
                label="Ảnh mặt sau"
                value={identity.backImageUrl}
                uploading={uploadingKey === "identity-back"}
                onUpload={(file) => void uploadIdentity("identity-back", "cccd_back", file)}
                onRemove={() => updateIdentity({ backImageUrl: "" })}
              />
            </>
          ) : (
            <FileUploadSlot
              id="application-identity-passport"
              label="Ảnh hộ chiếu"
              value={identity.passportImageUrl}
              uploading={uploadingKey === "identity-passport"}
              onUpload={(file) => void uploadIdentity("identity-passport", "passport", file)}
              onRemove={() => updateIdentity({ passportImageUrl: "" })}
            />
          )}
        </div>

        {Object.entries(ocrMessages)
          .filter(([key]) => key.startsWith("identity-"))
          .map(([key, message]) => (
            <p key={key} className="rounded-lg bg-primary/5 p-3 text-sm text-on-surface-variant">
              {message}
            </p>
          ))}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FloatingInput id="application-identity-number" label="Số giấy tờ" value={identity.documentNumber} onValueChange={(documentNumber) => updateIdentity({ documentNumber })} />
          <FloatingInput id="application-identity-name" label="Họ tên trên giấy tờ" value={identity.fullName} onValueChange={(fullName) => updateIdentity({ fullName })} />
          <FloatingInput id="application-identity-birth-date" label="Ngày sinh" type="date" value={identity.dateOfBirth || ""} max={today} error={dateErrors.identity.dateOfBirth} onValueChange={(dateOfBirth) => updateIdentity({ dateOfBirth })} />
          <label className="form-select">
            <span className="form-select__label">Giới tính</span>
            <select className="form-select__control" value={identity.gender || ""} onChange={(event) => updateIdentity({ gender: (event.target.value || undefined) as "male" | "female" | "other" | undefined })}>
              <option value="">Chưa cập nhật</option>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
              <option value="other">Khác</option>
            </select>
          </label>
          <FloatingInput id="application-identity-nationality" label="Quốc tịch" value={identity.nationality || ""} onValueChange={(nationality) => updateIdentity({ nationality })} />
          <FloatingInput id="application-identity-origin" label="Quê quán / Nơi sinh" value={identity.placeOfOrigin || ""} onValueChange={(placeOfOrigin) => updateIdentity({ placeOfOrigin })} />
          <FloatingInput id="application-identity-residence" label="Nơi thường trú" value={identity.placeOfResidence || ""} onValueChange={(placeOfResidence) => updateIdentity({ placeOfResidence })} />
          <FloatingInput id="application-identity-issued-place" label="Nơi cấp" value={identity.issuedPlace || ""} onValueChange={(issuedPlace) => updateIdentity({ issuedPlace })} />
          <FloatingInput id="application-identity-issued-at" label="Ngày cấp" type="date" value={identity.issuedAt || ""} max={today} error={dateErrors.identity.issuedAt} onValueChange={(issuedAt) => updateIdentity({ issuedAt })} />
          <FloatingInput id="application-identity-expires-at" label="Ngày hết hạn" type="date" value={identity.expiresAt || ""} min={identity.issuedAt || today} error={dateErrors.identity.expiresAt} onValueChange={(expiresAt) => updateIdentity({ expiresAt })} />
        </div>

        <FloatingTextarea
          id="provider-description"
          rows={7}
          maxLength={2000}
          label="Mô tả kinh nghiệm"
          value={form.description}
          onValueChange={(description) => onChange((current) => ({ ...current, description }))}
          hint={`${form.description.length}/2000 ký tự`}
        />
      </div>

      <div className="space-y-4 rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-title-md font-bold">Chứng chỉ nghề nghiệp</h3>
            <p className="mt-1 text-sm text-on-surface-variant">Chứng chỉ là tùy chọn.</p>
          </div>
          <button type="button" className="btn-secondary min-h-10 px-3 py-2" onClick={() => onChange((current) => ({ ...current, certificates: [...current.certificates, emptyCertificate()] }))}>
            <Plus size={18} /> Thêm chứng chỉ
          </button>
        </div>

        {form.certificates.length === 0 ? (
          <p className="rounded-lg border border-dashed border-outline-variant/60 bg-surface-container-low p-4 text-sm text-on-surface-variant">Chưa có chứng chỉ.</p>
        ) : (
          <div className="space-y-4">
            {form.certificates.map((certificate, index) => {
              const key = `certificate-${index}`;
              return (
                <div key={index} className="space-y-4 rounded-xl border border-outline-variant/40 bg-surface-container-low p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold">Chứng chỉ {index + 1}</p>
                    <button type="button" className="inline-flex items-center gap-1 text-sm font-bold text-error hover:underline" onClick={() => onChange((current) => ({ ...current, certificates: current.certificates.filter((_, currentIndex) => currentIndex !== index) }))}>
                      <Trash2 size={16} /> Xóa
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase text-on-surface-variant">Ảnh hoặc tài liệu chứng chỉ</p>
                      <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-on-primary transition hover:bg-primary/90">
                        <UploadCloud size={17} />
                        {uploadingKey === key ? "Đang tải và OCR..." : "Tải lên"}
                        <input type="file" accept="image/*,.pdf,.doc,.docx" disabled={uploadingKey === key} className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) void uploadCertificate(index, file); }} />
                      </label>
                    </div>
                    {certificate.imageUrls.length > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                        {certificate.imageUrls.map((url) => (
                          <UploadedAsset key={url} url={url} label={certificate.title || "Chứng chỉ"} onRemove={() => updateCertificate(index, { imageUrls: certificate.imageUrls.filter((item) => item !== url) })} />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-outline-variant/60 bg-surface-container-lowest p-5 text-center text-sm text-on-surface-variant">Chưa có tệp chứng chỉ.</div>
                    )}
                    {ocrMessages[key] && <p className="rounded-lg bg-primary/5 p-3 text-sm text-on-surface-variant">{ocrMessages[key]}</p>}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FloatingInput id={`application-certificate-title-${index}`} label="Tên chứng chỉ" value={certificate.title} onValueChange={(title) => updateCertificate(index, { title })} />
                    <FloatingInput id={`application-certificate-number-${index}`} label="Số chứng chỉ" value={certificate.certificateNumber || ""} onValueChange={(certificateNumber) => updateCertificate(index, { certificateNumber })} />
                    <FloatingInput id={`application-certificate-issuer-${index}`} label="Đơn vị cấp" value={certificate.issuer || ""} onValueChange={(issuer) => updateCertificate(index, { issuer })} />
                    <FloatingInput id={`application-certificate-issued-at-${index}`} label="Ngày cấp" type="date" value={certificate.issuedAt || ""} max={today} error={dateErrors.certificates[index]?.issuedAt} onValueChange={(issuedAt) => updateCertificate(index, { issuedAt })} />
                    <FloatingInput id={`application-certificate-expires-at-${index}`} label="Ngày hết hạn" type="date" value={certificate.expiresAt || ""} min={certificate.issuedAt || today} error={dateErrors.certificates[index]?.expiresAt} onValueChange={(expiresAt) => updateCertificate(index, { expiresAt })} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-2 rounded-2xl bg-surface-container-low p-4 text-sm">
        <p><b>Kinh nghiệm:</b> {formatExperienceYears(form.experienceYears)}</p>
        <p><b>Dịch vụ:</b> {selectedNames.join(", ") || "Chưa chọn"}</p>
        <p><b>Khu vực:</b> {form.workingAreas.join(", ") || "Chưa thêm"}</p>
        <p><b>Giấy tờ:</b> {hasIdentityImage ? "Đã tải ảnh để admin duyệt" : "Chưa tải ảnh"}</p>
        <p><b>Chứng chỉ:</b> {filledCertificates.length} mục</p>
      </div>
    </section>
  );
}
