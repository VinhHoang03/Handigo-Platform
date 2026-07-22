import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CertificateInlineForm } from "../ProviderProfileForms";
import { ProfileSection } from "../ProviderProfileComponents";
import type { ProviderCertificate } from "../../types/provider.types";
import type { CertificateForm } from "../../utils/providerProfilePage";
import { CertificateCard } from "./ProviderCertificateCard";
import { CertificateDetailModal } from "./ProviderCertificateDetailModal";

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
  onToggleVisibility,
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
  onToggleVisibility: (certificate: ProviderCertificate) => void;
  onDeleteCertificate: (certificateId: string) => void;
}) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedCertificate, setSelectedCertificate] =
    useState<ProviderCertificate | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenuId) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [openMenuId]);

  const certificateCards = useMemo(
    () =>
      certificates.map((certificate) => (
        <CertificateCard
          key={certificate.id}
          certificate={certificate}
          isMenuOpen={openMenuId === certificate.id}
          menuRef={menuRef}
          onToggleMenu={() =>
            setOpenMenuId((current) =>
              current === certificate.id ? null : certificate.id,
            )
          }
          onCloseMenu={() => setOpenMenuId(null)}
          onToggleVisibility={onToggleVisibility}
          onEditCertificate={onEditCertificate}
          onDeleteCertificate={onDeleteCertificate}
          onSelect={setSelectedCertificate}
        />
      )),
    [
      certificates,
      onDeleteCertificate,
      onEditCertificate,
      onToggleVisibility,
      openMenuId,
    ],
  );

  return (
    <>
      <ProfileSection
        title="Chứng chỉ nghề nghiệp"
        actions={
          isFormOpen ? undefined : (
            <button
              type="button"
              aria-label="Thêm chứng chỉ"
              className="grid h-11 w-11 place-items-center rounded-full bg-primary text-on-primary shadow-[0_8px_20px_rgba(53,37,205,0.18)] transition hover:bg-primary-hover hover:shadow-[0_10px_26px_rgba(53,37,205,0.24)]"
              onClick={onOpenCreate}
            >
              <span className="material-symbols-outlined">add</span>
            </button>
          )
        }
      >
        <div className="space-y-5">
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
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {certificateCards}
            </div>
          )}
        </div>
      </ProfileSection>

      <CertificateDetailModal
        certificate={selectedCertificate}
        open={Boolean(selectedCertificate)}
        onClose={() => setSelectedCertificate(null)}
      />
    </>
  );
}
