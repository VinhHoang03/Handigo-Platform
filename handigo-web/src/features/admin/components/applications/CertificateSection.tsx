import type { ApplicationCertificate } from "../../types/admin.types";
import { AssetPreview } from "./AssetPreview";
import { formatDate } from "./application-detail.utils";

export function CertificateSection({ certificates = [] }: { certificates?: ApplicationCertificate[] }) {
  if (!certificates.length) {
    return (
      <div className="rounded-2xl border border-dashed border-outline-variant/60 p-4 text-sm text-on-surface-variant">
        Hồ sơ chưa có chứng chỉ.
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <h3 className="font-bold">Chứng chỉ nghề nghiệp</h3>
      {certificates.map((certificate, index) => (
        <div key={certificate._id || certificate.id || index} className="space-y-3 rounded-2xl border border-outline-variant/50 p-4">
          <div>
            <p className="font-bold">{certificate.title}</p>
            <p className="text-sm text-on-surface-variant">
              {certificate.certificateNumber ? `Số ${certificate.certificateNumber} · ` : ""}
              {certificate.issuer || "Chưa cập nhật đơn vị cấp"} · Ngày cấp {formatDate(certificate.issuedAt)} · Hết hạn {formatDate(certificate.expiresAt)}
            </p>
          </div>
          {certificate.description && (
            <p className="rounded-lg bg-surface-container-low p-3 text-sm">{certificate.description}</p>
          )}
          {certificate.imageUrls.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {certificate.imageUrls.map((url) => <AssetPreview key={url} url={url} label={certificate.title} />)}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
