import { Plus, Trash2, UploadCloud } from "lucide-react";
import { FloatingInput } from "@/components/common/FloatingField";
import type { DateFieldErrors } from "../utils/providerApplicationValidation";
import type { ProviderApplicationCertificate } from "../types/providerApplication.types";
import { UploadedAsset } from "./ProviderApplicationUploadControls";

type ProviderCertificatesSectionProps = {
  certificates: ProviderApplicationCertificate[];
  uploadingKey: string;
  ocrMessages: Record<string, string>;
  dateErrors: DateFieldErrors[];
  today: string;
  onAddCertificate: () => void;
  onRemoveCertificate: (index: number) => void;
  onUpdateCertificate: (
    index: number,
    value: Partial<ProviderApplicationCertificate>,
  ) => void;
  onUploadCertificate: (index: number, file: File) => void;
};

export function ProviderCertificatesSection({
  certificates,
  uploadingKey,
  ocrMessages,
  dateErrors,
  today,
  onAddCertificate,
  onRemoveCertificate,
  onUpdateCertificate,
  onUploadCertificate,
}: ProviderCertificatesSectionProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-title-md font-bold">Chứng chỉ nghề nghiệp</h3>
          <p className="mt-1 text-sm text-on-surface-variant">
            Chứng chỉ là tùy chọn.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary min-h-10 px-3 py-2"
          onClick={onAddCertificate}
        >
          <Plus size={18} /> Thêm chứng chỉ
        </button>
      </div>

      {certificates.length === 0 ? (
        <p className="rounded-lg border border-dashed border-outline-variant/60 bg-surface-container-low p-4 text-sm text-on-surface-variant">
          Chưa có chứng chỉ.
        </p>
      ) : (
        <div className="space-y-4">
          {certificates.map((certificate, index) => {
            const key = `certificate-${index}`;
            return (
              <div
                key={index}
                className="space-y-4 rounded-xl border border-outline-variant/40 bg-surface-container-low p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold">Chứng chỉ {index + 1}</p>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-sm font-bold text-error hover:underline"
                    onClick={() => onRemoveCertificate(index)}
                  >
                    <Trash2 size={16} /> Xóa
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase text-on-surface-variant">
                      Ảnh hoặc tài liệu chứng chỉ
                    </p>
                    <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-on-primary transition hover:bg-primary/90">
                      <UploadCloud size={17} />
                      {uploadingKey === key ? "Đang tải và OCR..." : "Tải lên"}
                      <input
                        type="file"
                        accept="image/*,.pdf,.doc,.docx"
                        disabled={uploadingKey === key}
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.currentTarget.value = "";
                          if (file) onUploadCertificate(index, file);
                        }}
                      />
                    </label>
                  </div>
                  {certificate.imageUrls.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                      {certificate.imageUrls.map((url) => (
                        <UploadedAsset
                          key={url}
                          url={url}
                          label={certificate.title || "Chứng chỉ"}
                          onRemove={() =>
                            onUpdateCertificate(index, {
                              imageUrls: certificate.imageUrls.filter(
                                (item) => item !== url,
                              ),
                            })
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-outline-variant/60 bg-surface-container-lowest p-5 text-center text-sm text-on-surface-variant">
                      Chưa có tệp chứng chỉ.
                    </div>
                  )}
                  {ocrMessages[key] && (
                    <p className="rounded-lg bg-primary/5 p-3 text-sm text-on-surface-variant">
                      {ocrMessages[key]}
                    </p>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FloatingInput
                    id={`application-certificate-title-${index}`}
                    label="Tên chứng chỉ"
                    value={certificate.title}
                    onValueChange={(title) =>
                      onUpdateCertificate(index, { title })
                    }
                  />
                  <FloatingInput
                    id={`application-certificate-number-${index}`}
                    label="Số chứng chỉ"
                    value={certificate.certificateNumber || ""}
                    onValueChange={(certificateNumber) =>
                      onUpdateCertificate(index, { certificateNumber })
                    }
                  />
                  <FloatingInput
                    id={`application-certificate-issuer-${index}`}
                    label="Đơn vị cấp"
                    value={certificate.issuer || ""}
                    onValueChange={(issuer) =>
                      onUpdateCertificate(index, { issuer })
                    }
                  />
                  <FloatingInput
                    id={`application-certificate-issued-at-${index}`}
                    label="Ngày cấp"
                    type="date"
                    value={certificate.issuedAt || ""}
                    max={today}
                    error={dateErrors[index]?.issuedAt}
                    onValueChange={(issuedAt) =>
                      onUpdateCertificate(index, { issuedAt })
                    }
                  />
                  <FloatingInput
                    id={`application-certificate-expires-at-${index}`}
                    label="Ngày hết hạn"
                    type="date"
                    value={certificate.expiresAt || ""}
                    min={certificate.issuedAt || today}
                    error={dateErrors[index]?.expiresAt}
                    onValueChange={(expiresAt) =>
                      onUpdateCertificate(index, { expiresAt })
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
