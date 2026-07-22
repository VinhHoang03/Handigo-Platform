import type { PublicProviderProfile } from "../api/customerService.api";
import { InfoSection, VerificationRow } from "./ProviderProfilePrimitives";

const formatDate = (value?: string) => {
  if (!value) return "";
  return new Date(value).toLocaleDateString("vi-VN");
};

interface ProviderAboutSectionProps {
  bio?: string;
  description: string;
  certificates: PublicProviderProfile["provider"]["certificates"];
}

/** Giới thiệu chuyên gia và danh sách chứng chỉ công khai. */
export function ProviderAboutSection({
  bio,
  description,
  certificates,
}: ProviderAboutSectionProps) {
  return (
    <>
      <InfoSection title="Giới thiệu">
        <p>{bio || description}</p>
      </InfoSection>

      {certificates.length > 0 && (
        <InfoSection title="Chứng chỉ">
          {certificates.map((certificate) => (
            <VerificationRow
              key={certificate.id}
              icon="workspace_premium"
              title={certificate.title}
              description={[
                certificate.issuer,
                certificate.issuedAt
                  ? `Cấp ngày ${formatDate(certificate.issuedAt)}`
                  : "",
              ]
                .filter(Boolean)
                .join(" - ")}
            />
          ))}
        </InfoSection>
      )}
    </>
  );
}
