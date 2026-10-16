import type { PublicProviderProfile } from "../api/customerService.api";
import { InfoSection, VerificationRow } from "./ProviderProfilePrimitives";
import { Award } from "lucide-react";

const formatDate = (value?: string) => {
  if (!value) return "";
  return new Date(value).toLocaleDateString("vi-VN");
};

interface ProviderAboutSectionProps {
  bio?: string;
  description: string;
  certificates: PublicProviderProfile["provider"]["certificates"];
  compact?: boolean;
}

/** Giới thiệu thợ và danh sách chứng chỉ công khai. */
export function ProviderAboutSection({
  bio,
  description,
  certificates,
  compact = false,
}: ProviderAboutSectionProps) {
  return (
    <>
      <InfoSection title="Giới thiệu" compact={compact}>
        <p>{bio || description}</p>
      </InfoSection>

      {certificates.length > 0 && (
        <InfoSection title="Chứng chỉ" compact={compact}>
          {certificates.map((certificate) => (
            <VerificationRow
              compact={compact}
              key={certificate.id}
              icon={Award}
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
