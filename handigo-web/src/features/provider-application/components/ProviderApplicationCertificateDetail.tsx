import { FileText } from "lucide-react";
import type { ProviderApplicationCertificate } from "../types/providerApplication.types";
import { DownloadButton } from "./ProviderApplicationIdentityDetail";
import { formatDate, isImageUrl } from "./providerApplicationHistoryHelpers";

export function CertificateDetail({
  certificate,
}: {
  certificate: ProviderApplicationCertificate;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-outline-variant/40 p-4">
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <p>
          <b>Tên:</b> {certificate.title}
        </p>
        <p>
          <b>Số chứng chỉ:</b>{" "}
          {certificate.certificateNumber || "Chưa cập nhật"}
        </p>
        <p>
          <b>Đơn vị cấp:</b> {certificate.issuer || "Chưa cập nhật"}
        </p>
        <p>
          <b>Ngày cấp:</b> {formatDate(certificate.issuedAt)}
        </p>
        <p>
          <b>Ngày hết hạn:</b> {formatDate(certificate.expiresAt)}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {certificate.imageUrls.map((url) => (
          <div key={url} className="rounded-lg bg-surface-container-low p-3">
            {isImageUrl(url) ? (
              <img
                src={url}
                alt={certificate.title}
                className="h-36 w-full rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-36 items-center justify-center gap-2 text-primary">
                <FileText size={20} /> Tài liệu chứng chỉ
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary min-h-10 px-3 py-2 text-sm"
              >
                Xem
              </a>
              <DownloadButton url={url} label="chứng chỉ" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
