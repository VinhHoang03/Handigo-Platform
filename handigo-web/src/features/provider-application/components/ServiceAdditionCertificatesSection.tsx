import type { FormEvent } from "react";
import { CertificateInlineForm } from "@/features/provider/components/ProviderProfileForms";
import type { CertificateForm } from "@/features/provider/utils/providerProfilePage";

type ServiceAdditionCertificatesSectionProps = {
  certificates: CertificateForm[];
  certificateForm: CertificateForm;
  isCertificateFormOpen: boolean;
  isUploading: boolean;
  onOpenForm: () => void;
  onCloseForm: () => void;
  onFormChange: (form: CertificateForm) => void;
  onUpload: (file: File) => void;
  onSubmitForm: (event: FormEvent<HTMLFormElement>) => void;
  onRemoveCertificate: (index: number) => void;
};

export function ServiceAdditionCertificatesSection({
  certificates,
  certificateForm,
  isCertificateFormOpen,
  isUploading,
  onOpenForm,
  onCloseForm,
  onFormChange,
  onUpload,
  onSubmitForm,
  onRemoveCertificate,
}: ServiceAdditionCertificatesSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-on-surface">Chứng chỉ mới</h3>
          <p className="text-sm text-on-surface-variant">
            Đã thêm {certificates.length} chứng chỉ vào đơn.
          </p>
        </div>
        {!isCertificateFormOpen && (
          <button
            type="button"
            className="btn-secondary"
            onClick={onOpenForm}
          >
            Thêm chứng chỉ
          </button>
        )}
      </div>

      {isCertificateFormOpen && (
        <CertificateInlineForm
          form={certificateForm}
          isSaving={false}
          uploading={isUploading}
          showVisibility={false}
          onChange={onFormChange}
          onUpload={onUpload}
          onCancel={onCloseForm}
          onSubmit={onSubmitForm}
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {certificates.map((certificate, index) => (
          <article
            key={`${certificate.title}-${index}`}
            className="rounded-xl border border-outline-variant/40 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold">{certificate.title}</p>
                <p className="text-sm text-on-surface-variant">
                  {certificate.issuer || "Chưa cập nhật đơn vị cấp"}
                </p>
              </div>
              <button
                type="button"
                className="text-sm font-bold text-error"
                onClick={() => onRemoveCertificate(index)}
              >
                Xóa
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
