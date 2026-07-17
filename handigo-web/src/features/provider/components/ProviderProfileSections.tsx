import type { FormEvent } from "react";
import { InfoField, ProfileSection, SkillTags } from "./ProviderProfileComponents";
import {
  CertificateInlineForm,
  UploadedAssetPreview,
} from "./ProviderProfileForms";
import type { ProviderCertificate } from "../types/provider.types";
import type { CertificateForm } from "../utils/providerProfilePage";
import {
  certificateStatusLabel,
  formatDate,
} from "../utils/providerProfilePage";

export function ProfessionalSummarySection({
  bio,
  experience,
  skills,
  onEdit,
  onRequestServiceAddition,
}: {
  bio: string;
  experience: string;
  skills: string[];
  onEdit: () => void;
  onRequestServiceAddition: () => void;
}) {
  return (
    <ProfileSection
      title="Thông tin nghề nghiệp"
      actionLabel="Chỉnh sửa nghề nghiệp"
      onAction={onEdit}
    >
      <div className="space-y-6">
        <InfoField
          label="Giới thiệu chuyên môn"
          value={<p className="leading-relaxed text-on-surface-variant">{bio}</p>}
        />
        <InfoField label="Kinh nghiệm" value={experience} />
        <InfoField label="Các dịch vụ" value={<SkillTags skills={skills} />} />
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm text-on-surface-variant">
            Muốn nhận thêm loại dịch vụ mới, bạn cần gửi chứng chỉ để admin xét duyệt.
          </p>
          <button
            type="button"
            className="btn-primary mt-3"
            onClick={onRequestServiceAddition}
          >
            Đăng ký thêm dịch vụ
          </button>
        </div>
      </div>
    </ProfileSection>
  );
}

export function ProviderCertificatesSection({
  certificates,
  isFormOpen,
  form,
  error,
  isSaving,
  isUploading,
  onFormChange,
  onUpload,
  onSubmit,
  onCancelForm,
  onOpenCreate,
  onEditCertificate,
  onDeleteCertificate,
}: {
  certificates: ProviderCertificate[];
  isFormOpen: boolean;
  form: CertificateForm;
  error?: string;
  isSaving?: boolean;
  isUploading?: boolean;
  onFormChange: (form: CertificateForm) => void;
  onUpload: (file: File) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancelForm: () => void;
  onOpenCreate: () => void;
  onEditCertificate: (certificate: ProviderCertificate) => void;
  onDeleteCertificate: (certificateId: string) => void;
}) {
  return (
    <ProfileSection
      title="Chứng chỉ nghề nghiệp"
      actionLabel={isFormOpen ? undefined : "Thêm chứng chỉ"}
      onAction={onOpenCreate}
    >
      <div className="space-y-4">
        {isFormOpen && (
          <CertificateInlineForm
            form={form}
            error={error}
            isSaving={isSaving}
            uploading={isUploading}
            onChange={onFormChange}
            onUpload={onUpload}
            onSubmit={onSubmit}
            onCancel={onCancelForm}
          />
        )}

        {certificates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-outline-variant p-6 text-center text-on-surface-variant">
            Chưa có chứng chỉ nghề nghiệp.
          </div>
        ) : (
          certificates.map((certificate) => (
            <div
              key={certificate.id}
              className="rounded-xl border border-outline-variant/30 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="font-bold text-on-surface">
                    {certificate.title}
                  </h4>
                  <p className="text-sm text-on-surface-variant">
                    {certificate.issuer || "Chưa cập nhật đơn vị cấp"} •{" "}
                    {certificate.expiresAt
                      ? `Hết hạn ${formatDate(certificate.expiresAt)}`
                      : "Không thời hạn"}
                  </p>
                </div>
                <span className="rounded-full bg-surface-container px-3 py-1 text-xs font-bold text-on-surface-variant">
                  {certificateStatusLabel[certificate.status]}
                </span>
              </div>
              {certificate.description && (
                <p className="mt-3 text-sm text-on-surface-variant">
                  {certificate.description}
                </p>
              )}
              {certificate.rejectionReason && (
                <p className="mt-3 text-sm font-medium text-error">
                  {certificate.rejectionReason}
                </p>
              )}
              {certificate.imageUrls.length > 0 && (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {certificate.imageUrls.map((url) => (
                    <UploadedAssetPreview
                      key={url}
                      url={url}
                      label={certificate.title}
                    />
                  ))}
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-surface-container px-3 py-2 text-sm font-bold"
                  onClick={() => onEditCertificate(certificate)}
                >
                  Sửa
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-error/30 px-3 py-2 text-sm font-bold text-error"
                  disabled={isSaving}
                  onClick={() => onDeleteCertificate(certificate.id)}
                >
                  Xóa
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </ProfileSection>
  );
}
