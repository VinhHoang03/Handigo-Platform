import type {
  ProviderApplicationCertificate,
  ProviderApplicationOcrSuggestion,
  ProviderApplicationPayload,
} from "../types/providerApplication.types";

export const emptyCertificate = (): ProviderApplicationCertificate => ({
  title: "",
  certificateNumber: "",
  issuer: "",
  issuedAt: "",
  expiresAt: "",
  imageUrls: [],
});

export const isImageUrl = (url: string) =>
  /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(url) ||
  url.includes("/image/upload/");

export const formatExperienceYears = (years: number) => {
  if (years === 2) return "1-2 năm";
  if (years === 5) return "3-5 năm";
  if (years >= 6) return "Trên 5 năm";
  return `${years} năm`;
};

export const fillIdentityEmptyFields = (
  identity: ProviderApplicationPayload["identityDocument"],
  suggestion?: ProviderApplicationOcrSuggestion,
) => {
  if (!suggestion) return identity;
  return {
    ...identity,
    documentNumber: identity.documentNumber || suggestion.documentNumber || "",
    fullName: identity.fullName || suggestion.fullName || "",
    issuedPlace: identity.issuedPlace || suggestion.issuedPlace || "",
    issuedAt: identity.issuedAt || suggestion.issuedAt || "",
    expiresAt: identity.expiresAt || suggestion.expiresAt || "",
    dateOfBirth: identity.dateOfBirth || suggestion.dateOfBirth || "",
    gender: identity.gender || suggestion.gender,
    nationality: identity.nationality || suggestion.nationality || "",
    placeOfOrigin: identity.placeOfOrigin || suggestion.placeOfOrigin || "",
    placeOfResidence:
      identity.placeOfResidence || suggestion.placeOfResidence || "",
  };
};

export const fillCertificateEmptyFields = (
  certificate: ProviderApplicationCertificate,
  suggestion?: ProviderApplicationOcrSuggestion,
) => {
  if (!suggestion) return certificate;
  return {
    ...certificate,
    title: certificate.title || suggestion.title || "",
    certificateNumber:
      certificate.certificateNumber || suggestion.certificateNumber || "",
    issuer: certificate.issuer || suggestion.issuer || "",
    issuedAt: certificate.issuedAt || suggestion.issuedAt || "",
    expiresAt: certificate.expiresAt || suggestion.expiresAt || "",
  };
};
