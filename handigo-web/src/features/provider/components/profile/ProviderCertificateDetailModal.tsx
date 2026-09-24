import { Modal } from "@/components/common/Modal";
import type { ProviderCertificate } from "../../types/provider.types";
import { certificateStatusLabel, formatDate } from "../../utils/providerProfilePage";
import { CertificatePreviewSurface } from "./ProviderCertificatePreview";

export function CertificateDetailModal({
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
