import type { Dispatch, SetStateAction } from "react";
import type {
  Category,
  OcrDocumentKind,
  ProviderApplicationAssetUpload,
  ProviderApplicationCertificate,
  ProviderApplicationPayload,
} from "../types/providerApplication.types";
import {
  getProviderApplicationDateErrors,
  todayDate,
} from "../utils/providerApplicationValidation";
import { ProviderCertificatesSection } from "./ProviderCertificatesSection";
import { ProviderIdentityDocumentSection } from "./ProviderIdentityDocumentSection";
import {
  emptyCertificate,
  formatExperienceYears,
} from "./providerDescriptionStepHelpers";
import { useProviderDescriptionUploads } from "./useProviderDescriptionUploads";

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

export function ProviderDescriptionStep({
  form,
  categories,
  onChange,
  onUploadAsset,
}: ProviderDescriptionStepProps) {
  const {
    uploadingKey,
    uploadError,
    ocrMessages,
    uploadIdentity,
    uploadCertificate,
  } = useProviderDescriptionUploads(onChange, onUploadAsset);
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
        <h2 className="text-headline-md font-bold">
          Giới thiệu và hồ sơ xác thực
        </h2>
        <p className="mt-1 text-on-surface-variant">
          Tải giấy tờ để hệ thống tự điền thông tin, sau đó kiểm tra trước khi
          gửi.
        </p>
      </div>

      {uploadError && (
        <p className="rounded-2xl bg-error/10 p-3 text-sm text-error">
          {uploadError}
        </p>
      )}

      <ProviderIdentityDocumentSection
        identity={identity}
        dateErrors={dateErrors.identity}
        today={today}
        uploadingKey={uploadingKey}
        ocrMessages={ocrMessages}
        description={form.description}
        onUpdateIdentity={updateIdentity}
        onUploadIdentity={(key, kind, file) =>
          void uploadIdentity(key, kind, file)
        }
        onDescriptionChange={(description) =>
          onChange((current) => ({ ...current, description }))
        }
      />

      <ProviderCertificatesSection
        certificates={form.certificates}
        uploadingKey={uploadingKey}
        ocrMessages={ocrMessages}
        dateErrors={dateErrors.certificates}
        today={today}
        onAddCertificate={() =>
          onChange((current) => ({
            ...current,
            certificates: [...current.certificates, emptyCertificate()],
          }))
        }
        onRemoveCertificate={(index) =>
          onChange((current) => ({
            ...current,
            certificates: current.certificates.filter(
              (_, currentIndex) => currentIndex !== index,
            ),
          }))
        }
        onUpdateCertificate={updateCertificate}
        onUploadCertificate={(index, file) =>
          void uploadCertificate(index, file)
        }
      />

      <div className="space-y-2 rounded-2xl bg-surface-container-low p-4 text-sm">
        <p>
          <b>Kinh nghiệm:</b> {formatExperienceYears(form.experienceYears)}
        </p>
        <p>
          <b>Dịch vụ:</b> {selectedNames.join(", ") || "Chưa chọn"}
        </p>
        <p>
          <b>Khu vực:</b> {form.workingAreas.join(", ") || "Chưa thêm"}
        </p>
        <p>
          <b>Giấy tờ:</b>{" "}
          {hasIdentityImage ? "Đã tải ảnh để admin duyệt" : "Chưa tải ảnh"}
        </p>
        <p>
          <b>Chứng chỉ:</b> {filledCertificates.length} mục
        </p>
      </div>
    </section>
  );
}
