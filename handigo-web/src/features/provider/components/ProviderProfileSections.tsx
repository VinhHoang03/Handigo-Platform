import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Modal } from "@/components/common/Modal";
import {
  InfoField,
  ProfileSection,
  SkillTags,
} from "./ProviderProfileComponents";
import { CertificateInlineForm } from "./ProviderProfileForms";
import type { ProviderCertificate } from "../types/provider.types";
import type { CertificateForm } from "../utils/providerProfilePage";
import {
  certificateStatusLabel,
  formatDate,
  isImageUrl,
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
      actions={
        <div className="flex flex-wrap items-center justify-end gap-sm">
          <button
            type="button"
            className="btn-secondary min-h-11 min-w-[188px] px-4 py-2 text-sm border-outline-variant/60 bg-surface-container-lowest text-center shadow-[0_4px_20px_rgba(19,27,46,0.05)] hover:border-primary/35"
            onClick={onEdit}
          >
            Chỉnh sửa nghề nghiệp
          </button>
          <div className="group relative">
            <button
              type="button"
              className="btn-primary min-h-11 min-w-[188px] px-4 py-2 text-sm"
              onClick={onRequestServiceAddition}
              aria-describedby="service-addition-tooltip"
            >
              Đăng ký thêm dịch vụ
            </button>
            <div
              id="service-addition-tooltip"
              role="tooltip"
              className="pointer-events-none absolute right-0 top-full z-20 mt-3 w-72 translate-y-1 rounded-xl bg-on-surface px-4 py-3 text-sm leading-6 text-surface opacity-0 shadow-lg transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
            >
              Muốn nhận thêm loại dịch vụ mới, bạn cần gửi chứng chỉ để admin
              xét duyệt.
              <span className="absolute -top-2 right-6 h-4 w-4 rotate-45 rounded-[2px] bg-on-surface" />
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <InfoField
          label="Giới thiệu chuyên môn"
          value={
            <p className="leading-relaxed text-on-surface-variant">{bio}</p>
          }
        />
        <InfoField label="Kinh nghiệm" value={experience} />
        <InfoField label="Các dịch vụ" value={<SkillTags skills={skills} />} />
      </div>
    </ProfileSection>
  );
}

function CertificateDetailModal({
  certificate,
  open,
  onClose,
}: {
  certificate: ProviderCertificate | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!certificate) return null;

  return (
    <Modal open={open} title={certificate.title} onClose={onClose} size="lg">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
          <span className="rounded-full bg-surface-container px-3 py-1 font-bold">
            {certificateStatusLabel[certificate.status]}
          </span>
          <span>{certificate.issuer || "Chưa cập nhật đơn vị cấp"}</span>
          <span>
            {certificate.expiresAt
              ? `Hết hạn ${formatDate(certificate.expiresAt)}`
              : "Không thời hạn"}
          </span>
        </div>

        {certificate.description && (
          <div className="rounded-2xl bg-surface-container-low p-4">
            <p className="text-sm leading-6 text-on-surface-variant">
              {certificate.description}
            </p>
          </div>
        )}

        {certificate.rejectionReason && (
          <div className="rounded-2xl bg-error/10 p-4 text-sm text-error">
            {certificate.rejectionReason}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {certificate.imageUrls.map((url) => (
            <CertificatePreviewSurface
              key={url}
              url={url}
              label={certificate.title}
              heightClass="h-72"
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}

function CertificatePreviewSurface({
  url,
  label,
  heightClass = "h-64",
}: {
  url: string;
  label: string;
  heightClass?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-low p-3">
      {isImageUrl(url) ? (
        <div
          className={`flex w-full items-center justify-center overflow-hidden rounded-xl border border-outline-variant/30 bg-white ${heightClass}`}
        >
          <img src={url} alt={label} className="h-full w-full object-contain" />
        </div>
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className={`flex w-full items-center justify-center rounded-xl border border-outline-variant/30 bg-white text-sm font-bold text-primary ${heightClass}`}
        >
          Xem tài liệu
        </a>
      )}
    </div>
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
      certificates.map((certificate) => {
        const previewUrl =
          certificate.imageUrls.find((url) => isImageUrl(url)) ||
          certificate.imageUrls[0] ||
          "";
        const isMenuOpen = openMenuId === certificate.id;

        return (
          <article
            key={certificate.id}
            className="group relative overflow-hidden rounded-2xl border border-outline-variant/30 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-primary/25 hover:shadow-[0_12px_32px_rgba(19,27,46,0.10)]"
          >
            <div
              className="absolute right-3 top-3 z-10"
              ref={isMenuOpen ? menuRef : undefined}
            >
              <button
                type="button"
                aria-label="Mở menu chứng chỉ"
                className="grid h-9 w-9 place-items-center rounded-full bg-white/92 text-on-surface shadow-sm ring-1 ring-outline-variant/40 transition hover:bg-surface-container-low"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpenMenuId((current) =>
                    current === certificate.id ? null : certificate.id,
                  );
                }}
              >
                <span className="material-symbols-outlined text-[18px]">
                  more_horiz
                </span>
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-20 min-w-36 overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-1.5 shadow-[0_16px_40px_rgba(19,27,46,0.16)]">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-on-surface transition hover:bg-primary/5"
                    onClick={() => {
                      setOpenMenuId(null);
                      onToggleVisibility(certificate);
                    }}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {certificate.isPublic ? "visibility_off" : "visibility"}
                    </span>
                    {certificate.isPublic ? "Chuyển riêng tư" : "Công khai"}
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-on-surface transition hover:bg-primary/5"
                    onClick={() => {
                      setOpenMenuId(null);
                      onEditCertificate(certificate);
                    }}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      edit
                    </span>
                    Sửa
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-error transition hover:bg-error/5"
                    onClick={() => {
                      setOpenMenuId(null);
                      onDeleteCertificate(certificate.id);
                    }}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      delete
                    </span>
                    Xóa
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              className="block w-full text-left"
              onClick={() => {
                setOpenMenuId(null);
                setSelectedCertificate(certificate);
              }}
            >
              <div className="bg-surface-container-low p-3">
                {previewUrl ? (
                  isImageUrl(previewUrl) ? (
                    <div className="flex h-48 w-full items-center justify-center overflow-hidden rounded-xl border border-outline-variant/30 bg-white">
                      <img
                        src={previewUrl}
                        alt={certificate.title}
                        className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.01]"
                      />
                    </div>
                  ) : (
                    <div className="flex h-48 w-full items-center justify-center rounded-xl border border-outline-variant/30 bg-white text-primary">
                      <span className="material-symbols-outlined text-5xl">
                        description
                      </span>
                    </div>
                  )
                ) : (
                  <div className="flex h-48 w-full items-center justify-center rounded-xl border border-outline-variant/30 bg-white text-on-surface-variant">
                    <span className="material-symbols-outlined text-5xl">
                      image_not_supported
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2 p-4">
                <div>
                  <h4 className="line-clamp-2 font-bold text-on-surface">
                    {certificate.title}
                  </h4>
                  <p className="mt-1 line-clamp-1 text-sm text-on-surface-variant">
                    {certificate.issuer || "Chưa cập nhật đơn vị cấp"}
                  </p>
                  <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${certificate.isPublic ? "bg-secondary-container/30 text-secondary" : "bg-surface-container text-on-surface-variant"}`}>
                    <span className="material-symbols-outlined text-[14px]">
                      {certificate.isPublic ? "public" : "lock"}
                    </span>
                    {certificate.isPublic ? "Công khai" : "Riêng tư"}
                  </span>
                </div>
              </div>
            </button>
          </article>
        );
      }),
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
              className="grid h-11 w-11 place-items-center rounded-full bg-primary text-on-primary shadow-[0_8px_20px_rgba(53,37,205,0.18)] transition hover:bg-primary-container hover:shadow-[0_10px_26px_rgba(53,37,205,0.24)]"
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
